/**
*
*
*/

var fs = require('fs')
var normalizeForSearch = require('normalize-for-search')
var S = require('string')
var _ = require('underscore')
const SVD = require('node-svd')



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
