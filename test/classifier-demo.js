const fs = require('fs')
const natural = require('natural');

const loadSubjectFiles = subjects =>
  subjects.reduce((acc, subject) => ({
    ...acc,
    [subject]: JSON.parse(fs.readFileSync(`./test/${subject}-articles.json`, 'utf8'))
  }), {})

const loadData = (subjects, split = 0.5) => {
  const subjectData = loadSubjectFiles(subjects)
  return splitData = subjects.reduce((acc, subject) =>
    ({
      ...acc,
      [subject]: splitSubject(subjectData[subject], split)
    }), {})
}

const splitSubject = (data, split) => {
  const splitPoint = data.length * split
  return {
    train: data.slice(0, splitPoint),
    test: data.slice(splitPoint + 1)
  }
}

// train the classifier
const trainClassifier = (subjectData) => {
  const classifier = new natural.BayesClassifier();
  Object.keys(subjectData).forEach(subject => {
    console.log(`Adding ${subject}`)
    subjectData[subject].train.forEach(text => classifier.addDocument(text, subject))
  })
  console.log('Training models')
  classifier.train()
  return classifier
}
  
const testClassifier = (classifier, subjectData) => {
  const subjects = Object.keys(subjectData)
  const confusionMatrix = Array(subjects.length).fill().map(() => Array(subjects.length).fill(0))
  let correct = 0
  let totalTestData = 0
  subjects.forEach(subject => {
    subjectData[subject].test.forEach(testText => {
      const predicted = classifier.classify(testText)
      correct += predicted === subject ? 1 : 0
      if (predicted !== subject) {
        const classified = classifier.getClassifications(testText)
        console.log('error:', subject, predicted, testText, classified.map(({ label, value }) => `${label}: ${(value).toFixed(15)}`) )
      }
      totalTestData++
    })
  })
  console.log('total test data: ', totalTestData)
  console.log('correct', correct)
  console.log('Accuracy', (correct/totalTestData))
}

const data = loadData(['sport', 'business', 'entertainment', 'lifestyle', 'tech'], 0.8)
const classifier = trainClassifier(data)
testClassifier(classifier, data)


process.exit();




console.log(classifier.classify('I like cycling in the tour de france'));
console.log(classifier.classify('10 ways to be amazing at business'));

process.exit();
