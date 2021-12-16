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

const preprocess = (a) => a.map(article => '"'+article.title+'"').join(',');
const mtb = JSON.parse(fs.readFileSync('./../readikus/mountain-biking-ngram-data.json', 'utf8'))
const world = JSON.parse(fs.readFileSync('./../readikus/world-news-ngram-data.json', 'utf8'))



console.log('document = ['+preprocess(mtb.slice(0, 75).concat(world.slice(0, 75))) + ']');

