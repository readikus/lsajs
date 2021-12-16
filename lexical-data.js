/**
* most common words,
for each word, the most common words that appear after it,
most common words that appear before it (+ frequency + probs)
*
*/

var fs = require('fs')
var normalizeForSearch = require('normalize-for-search')
var S = require('string')
var _ = require('underscore')
const SVD = require('node-svd')


const SimpleCluster = require('./lib/simple-cluster')
const util = require('./lib/util')

const moment = require('moment')
const natural = require('natural')
const NGrams = natural.NGrams

module.exports = class LexicalData {
  constructor (options) {
    this.words = []
    // setup stemming
    natural.PorterStemmer.attach()
  }

  /**
   * addAll() ingests a set of documents into the current Ramekin.
   * @param {strings} an array of strings
   */
  addAll (strings) {
    strings.forEach(s => {
      this.add(s)
    })
  }

  /**
   * Ingest a single document into the ramekin.
   *
   * @param doc document to ingest, in this format:
   *   {
   *     _id: <Unique ID - can be any format>,
   *     body: "Text",
   *     date: <ISO Date format string, or JavaScript date object>,
   *     subject: <Any object>
   *   }
   */
  add (s) {


    if (!(doc.date instanceof Date)) {
      doc.date = new Date(doc.date)
    }

    // ensure there is an id set
    if (!doc.hasOwnProperty('_id')) {
      throw new Error('No \'_id\' field set for document')
    }

    // throw error if the document already exists in the ramekin
    if (this.docs.hasOwnProperty(doc._id)) {
      throw new Error(`Document ${doc._id} has already been added to the ramekin`)
    }

    // we may need to revisit what doc data we store
    this.docs[doc._id] = doc

    // generate all the [1...n]-grams for the document
    for (let n = 1; n <= this.options.maxN; n++) {
      // create ngrams from the normalised text
      let ngrams = NGrams.ngrams(this.normalise(doc.body), n)

      // ingest all the ngrams
      ngrams.forEach(ngram => { this.ingestNGram(ngram, doc) })
    }
  }

  /**
   * Text analysis stage to take some raw text and convert
   * it into a format that we can ingest optimally.
   * @todo: create a function to map the original text
   * with the normalised version.
   */
  normalise (s) {
    // normalise the body text (handling stop words)
    return s.tokenizeAndStem(this.options.keepStops).join(' ')
  }


  // get the most common wordsx

  /**
   * Add a new ngram into the ramekin.
   */
  ingestNGram (ngram, doc) {
    // construct the storable ngram object
    this.ngrams[ngram.length].push({
      date: doc.date,
      ngram,
      subject: doc.subject
    })
    // hash the historical data
    if (!this.ngramHistory.hasOwnProperty(ngram)) {
      this.ngramHistory[ngram] = { occurances: [] }
    }
    this.ngramHistory[ngram].occurances.push({date: doc.date, doc_id: doc._id})
  }

  trendUsedPhrases (usedPhrases, { start, end, historyStart, historyEnd }) {
    // score each phrase from the trend period compared to it's historic use
    return usedPhrases.reduce((acc, phrase) => {
      // score if the phrase has trended in the last 24 hours
      const trendDocs = this.findDocs(phrase, { start, end })
      const historyRangeCount = this.count(phrase, { start: historyStart, end: historyEnd })
      const historyDayAverage = (historyRangeCount / this.options.historyDays) * this.options.historyFrequencyTolerance

      // if it's above the average
      if ((trendDocs.length > this.options.minTrendFreq) && (trendDocs.length > historyDayAverage)) {
        acc.push({ phrase,
          score: (trendDocs.length / (historyDayAverage + 1)) * phrase.length,
          historyRangeCount,
          trendRangeCount: trendDocs.length,
          docs: trendDocs })
      }
      return acc
    }, [])
  }

  buildSearchCriteria(initialOptions = {}) {
    const start = initialOptions.start || moment().subtract(1, 'day').toDate()
    const end = initialOptions.end || new Date()
    const historyEnd = initialOptions.historyEnd || initialOptions.start || moment().subtract(1, 'day').toDate()
    const historyStart = initialOptions.historyStart || moment(historyEnd).subtract(this.options.historyDays, 'day').toDate()
    return { start, end, historyEnd, historyStart }
  }

  static getDocPhrasesFromTrends (trendPhrases) {
    return trendPhrases.reduce((acc, {docs, phrase}) => {
      docs.forEach(doc => {
        acc[doc] = (acc[doc] || []).concat([ phrase ])
      })
      return acc
    }, {})
  }

  /**
   * Validate the trending options, setting defaults where necessary.
   * @todo: this whole block is manky and needs a refactor - setup, search and cluster
   */
  trending (initialOptions = {}) {
    const searchOptions = this.buildSearchCriteria(initialOptions)

    // start of trending:search

    // find all the common phrases used in respective subject, over the past day
    const usedPhrases = this.usedPhrases(searchOptions)
    console.log(`There are ${usedPhrases.length} used phrases and ${Object.keys(this.docs).length} docs`)
    // duplicated data used later for sorting
    let trendPhrases = this.trendUsedPhrases(usedPhrases, searchOptions)

    if (trendPhrases.length === 0) return []

    // remove sub phrases (i.e. "Tour de", compared to "Tour de France")
    trendPhrases = this.removeSubPhrases(trendPhrases)

    const docPhrases = this.constructor.getDocPhrasesFromTrends(trendPhrases)

    // rank results - @todo: needs making nicer
    trendPhrases.sort((a, b) =>
      b.score === a.score ? b.phrase.length - a.phrase.length : b.score - a.score
    )

    // cluster similar trends - find the phrase that is most similar to so many
    // others (i.e. i, where sum(i) = max( sum() )
    const sc = new SimpleCluster(trendPhrases)
    const trends = sc.cluster()
    // rank the documents in each cluster, based on the docs etc.
    trends.forEach(trend => {
      const docs = trend.docs.map(doc => ({
        doc,
        matches: util.intersection(docPhrases[doc], trend.phrases).length
      }))
      docs.sort((a, b) => b.matches - a.matches)
      // remove unnecessary sort data now it is sorted
      trend.docs = docs.map(doc => doc.doc)
    })

    return trends
  }// currently line 280

  /**
   * Finds the phrases used in a particular date range.
   * @todo: error handling.
   * @todo: this may be the main bottle neck - if a hashmap is created,
   * it reduces the searches and just sets the value each time.
   * returning just the values (or keys) would be quick??
   */
  usedPhrases ({start, end}) {
    const filterRow = row => row.date >= start && row.date < end
    const phrases = new Set()
    // load all the unique phrases
    for (let n = 1; n <= this.options.maxN; n++) {
      this.ngrams[n].filter(filterRow).forEach(row => {
        phrases.add(row.ngram)
      })
    }
    return [...phrases]
  }// currently line 307

  /**
   * Count the number of times that an ngrams has occurred within the
   * conditions of the options.
   *
   * @param ngram
   * @param options
   * @return int
   */
  count (ngram, options) {
    let matchingDocs = this.findDocs(ngram, options)
    return matchingDocs.length
  }

  /**
   * Preprocess the results to only retain the longest phrases. For example,
   * if we have "Tour de France", we don't really

   remove noise. Fo
   * Improvement: potentially sort results by length before processing.
   * @todo: move to trending component.
   */
  removeSubPhrases (trendPhrases) {
    for (let i = 0; i < trendPhrases.length; i++) {
      for (let j = i + 1; j < trendPhrases.length; j++) {
        if (util.isSubPhrase(trendPhrases[i].phrase, trendPhrases[j].phrase)) {
          // keep the biggest one
          const spliceI = trendPhrases[i].length > trendPhrases[j].length ? j : i
          // remove the element from the array
          trendPhrases.splice(spliceI, 1)
          // start processing again from the element that was cut out
          i = j = spliceI
        }
      }
    }
    return trendPhrases
  }

  /**
   * Find all the doc ids for a given ngram, matching the options.
   */
  findDocs (ngram, options) {
    const history = this.ngramHistory[ ngram ]

    if (history === undefined) return []

    return history.occurances.reduce((acc, doc) => {
      if ((doc.date >= options.start && doc.date < options.end) &&
        (!options.hasOwnProperty('subject') || options.subject === this.docs[ doc.doc_id ].subject)) {
          return acc.concat(doc.doc_id)
      }
      return acc
    }, [])
  }
}







//npm i remove-punctuation


function normalize( s ){
  //console.log('normalize', s)

	// separate hyphenated words
	//s = s.replaceAll( "-", " " ); // this does affectively make it impossible to search for '-

	s = normalizeForSearch( s );

	// this needs removing!!
    s = S(s).stripPunctuation().s;

    return s.split(' ');

}

//stopwords = ['and','edition','for','in','little','of','the','to'] 
//ignorechars = ''',:'!'''

String.prototype.replaceAll = function(search, replacement) {
	var target = this;
	return target.replace(new RegExp(search, 'g'), replacement);
};

class LSA {

  constructor() {
		this.stopWords = JSON.parse(fs.readFileSync('./stop-words.full.json', 'utf8'))
		this.dictionary = {}
    this.documentCount = 0
    this.svd = undefined

    this.rawWords = undefined
    this.docs = []
  }

  /**
   * Python - Parse Documents
   * The parse method takes a document, splits it into words, removes the ignored
   * characters and turns everything into lowercase so the words can be compared 
   * to the stop words. If the word is a stop word, it is ignored and we move on 
   * to the next word. If it is not a stop word, we put the word in the dictionary, 
   * and also append the current document number to keep track of which documents 
   * the word appears in.
   * 
   * The documents that each word appears in are kept in a list associated with that
   * word in the dictionary. For example, since the word book appears in titles 3 
   * and 4, we would have self.wdict['book'] = [3, 4] after all titles are parsed.
   * 
   * After processing all words from the current document, we increase the document 
   * count in preparation for the next document to be parsed.
   */
  parseDocument(doc) {
    // split the document to words
    const words = normalize(doc);
    // process each word individually
    words.map(word => {
      if (this.stopWords.find(stopWord => word === stopWord) !== undefined) {
	      // do nothing, it's a stop word, and it doesn't add any meaning
      } else if (this.dictionary[word] !== undefined) {
        this.dictionary[word].push(this.documentCount)
      } else {
        this.dictionary[word] = [this.documentCount];
			}
    })
    this.documentCount++
    this.docs.push(doc)
  }

/**
 * Python - Build the Count Matrix
 * 
 * Once all documents are parsed, all the words (dictionary keys) that are
 * in more than 1 document are extracted and sorted, and a matrix is built
 * with the number of rows equal to the number of words (keys), and the 
 * number of columns equal to the document count. Finally, for each word 
 * (key) and document pair the corresponding matrix cell is incremented.
 */
  buildCountMatrix() {
		// only consider words that occur more than once
		this.rawWords = _.keys(this.dictionary).filter(word => this.dictionary[word].length > 1)
    this.rawWords.sort()
    
    console.log('this.rawWords', this.rawWords)
		// zero array
    this.A = Array(this.rawWords.length).fill().map(() => Array(this.documentCount).fill(0))

    this.rawWords.map((word, i) => {
      for (let k = 0; k < this.dictionary[word].length; k++) {
        const doc_i_k = this.dictionary[word][k];
        this.A[i][doc_i_k]++;
      }
		})
    console.log('this.A', this.A);

    this.tfIdf()
  }

  tfIdf() {
//    WordsPerDoc = sum(self.A, axis=0)        
  //  DocsPerWord = sum(asarray(self.A > 0, 'i'), axis=1)
    //rows, cols = self.A.shape
    this.AtfIdf = []
    const wordsPerDoc = this.docs.map((doc, j) =>
      this.A.map(row => row[j]).reduce((sum, value) => sum + value, 0))
    const docsPerWord = this.A.map((row, j) => 
      row.reduce((sum, value) => sum + value, 0)
    )
    for (let i = 0; i < this.A.length; i++) {
      this.AtfIdf[i] = []
      const word = this.rawWords[i]
      for(let j = 0; j < this.A[i].length; j++) {
        this.AtfIdf[i][j] = (this.A[i][j] / wordsPerDoc[j]) * Math.log(this.A[i].length / docsPerWord[i])
        if (isNaN(this.AtfIdf[i][j])) {
          this.AtfIdf[i][j] = 0
        }
      }
    }
  }

  getWordVectors() {
    return this.svd.U.map((vector, i) => ({
      word: this.rawWords[i],
      vector
    }))
  }

  getDocVectors() {
    return this.svd.V.map((vector, i) => ({
      doc: this.docs[i],
      vector
    }))
  }

  calc() {
    return this.svd = SVD.svd(this.AtfIdf)
  }
}

module.exports = LSA
