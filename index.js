/**
*
*
*/


var fs = require('fs');
var normalizeForSearch = require('normalize-for-search');
var S = require('string');
var _ = require('underscore');




//stopwords = ['and','edition','for','in','little','of','the','to'] 
//ignorechars = ''',:'!'''

fs = require('fs');

/** load the data needed to get the algorithm functioning */
function init( callback ){

	// initialize the dictionary
	this.dictionary = {};
	this.documentCount = 0;

	fs.readFile( './stop-words2.json', 'utf8', function ( err, stopWords ) {
  
	    if (err) throw err;

	    fs.readFile( './article-titles.json', 'utf8', function ( err, articleTitles ) {
	
		    if (err) throw err;

		    this.stopWords = JSON.parse(stopWords);
		    this.articleTitles = JSON.parse(articleTitles);

		    callback(this.stopWords, this.articleTitles);
	
		});

	});
}

init( function( stopWords, titles ){

//	console.log(stopWords);
//	console.log(titles);

	for( var i = 0; i < titles.length; i++ ){

		parseDocument( titles[i] );

	}

//	console.log(this.dictionary);

	buildCountMatrix();

console.log( this.A );

});













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
function parseDocument(doc){

	// split the document to words
	var words = normalize(doc);

	// process each word individually
	for( var i = 0; i < words.length; i++ ){

		var word = words[i];

		if ( this.stopWords.hasOwnProperty( word ) ){
			// do nothing, it's a stop word, and it doesn't add any meaning
		}
		else if( this.dictionary.hasOwnProperty( word ) ){
			this.dictionary[word].push( this.documentCount );
		}else{
			this.dictionary[word] = [];
			this.dictionary[word].push( this.documentCount );
		}
		
	}
	this.documentCount += 1

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
function buildCountMatrix(){


this is flakey - test with a small volume of titles
	var rawWords = _.keys( this.dictionary );
	rawWords.sort();
	console.log(rawWords);
	this.A = [];

	for ( var i = 0; i < rawWords.length; i++ ){

		this.A[i] = [];
		var word = rawWords[i];

		for ( var k = 0; k < this.dictionary[ word ].length; k++ ){

			var doc_i_k = this.dictionary[ word ][ k ];

			if( this.A[ i ][ doc_i_k ] == undefined ){
				this.A[ i ][ doc_i_k ] = 0;
			}

			this.A[ i ][ doc_i_k ]++;

		}

	}


	/*
	self.A = zeros([len(self.keys), self.dcount]) 

*/}







String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};



function normalize( s ){

	// separate hyphenated words
	s = s.replaceAll( "-", " " ); // this does affectively make it impossible to search for '-

	s = normalizeForSearch( s );
    s = S(s).stripPunctuation().s;

    return s.split(' ');

}