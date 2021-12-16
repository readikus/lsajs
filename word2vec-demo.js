const w2v = require( 'word2vec' );
const sampleData = require('./sample-data.json');

console.log('sample data', sampleData);

w2v.word2phrase('/Users/ian/Dev/lsajs/input.txt', '/Users/ian/Dev/lsajs/word2vec.model', {}, (result) => {
console.log('result', result, w2v)
});   




w2v.word2vec( __dirname + '/fixtures/phrases.txt', __dirname + '/fixtures/vectors.txt', {
	cbow: 1,
	size: 200,
	window: 8,
	negative: 25,
	hs: 0,
	sample: 1e-4,
	threads: 20,
	iter: 15,
	minCount: 2
});


});

console.log('end')