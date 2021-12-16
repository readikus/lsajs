const fs = require('fs')
const math = require('mathjs')

const LSA = require('../lsa')

const getTidyData = (data) => {
    //return data;
    const stdTolerance = 1
    const meanX = math.mean(data.map(vector => vector.x))
    const stdX = math.std(data.map(vector => vector.x))
  
    const meanY = math.mean(data.map(vector => vector.y))
    const stdY = math.std(data.map(vector => vector.y))
  
    console.log('meanX', meanX);
    console.log('stdX', stdX);
    console.log('meanY', meanY);
    console.log('stdY', stdY);
  
    const lowerX = meanX - stdX * stdTolerance
    const upperX = meanX + stdX * stdTolerance
    const lowerY = meanY - stdY * stdTolerance
    const upperY = meanY + stdY * stdTolerance
  
    return data.filter(row => {
      return row.x >= lowerX && row.x <= upperX && row.y >= lowerY && row.y <= upperY
    })
  }

const loadTestSubjects = subjects =>
subjects.reduce((acc, subject) => acc.concat(JSON.parse(fs.readFileSync(`./test/${subject}-articles.json`, 'utf8'))), [])
const lsa = new LSA()
//const titles = JSON.parse(fs.readFileSync( './test/titles.small.json', 'utf8'))
//const titles = JSON.parse(fs.readFileSync( './article-titles.json', 'utf8'))
//const titles = loadTestSubjects(['mountain-biking'])
const titles = loadTestSubjects(['cycling'])
//const titles = loadTestSubjects(['entertainment', 'sport', 'business', 'tech'])
console.log('titles', titles)
//console.log('tit;es', titles)
//process.exit()
titles.map(title => {
lsa.parseDocument(title)
})
//console.log('lsa', lsa)
console.log(lsa.rawWords)

lsa.buildCountMatrix()


//process.exit()
    
//console.log(lsa.A);
console.log('built matrix')
const calcs = lsa.calc();
//console.log('getWordVectors', JSON.stringify(lsa.getWordVectors()));
console.log('performed SVD')

const words = getTidyData(lsa.getWordVectors().map(vector => ({ 
label: vector.word,
x: vector.vector[1],
y: vector.vector[2],
color: 'red'
})))
const docs = getTidyData(lsa.getDocVectors().map((vector, i) => ({ 
label: `Doc_${i} ${vector.doc}` ,
x: vector.vector[1],
y: vector.vector[2],
color: 'blue'
})))


//console.log('tidy data', getTidyData(words))

//console.log('', words.concat(docs).slice(0, 100));
//fs.writeFileSync('../charts/src/vectors.js', 'export const data = ' +JSON.stringify(words.concat(docs).slice(0, 1000)))
fs.writeFileSync('../charts/src/vectors.js', 'export const data = ' +JSON.stringify(words));//.concat(docs)))
//fs.writeFileSync('../charts/src/vectors.js', 'export const data = ' +JSON.stringify(getTidyData(words)))
//lsa.printSVD()


console.log('written files')

process.exit();

