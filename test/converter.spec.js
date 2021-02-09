/* global describe it */
// const util = require('util')
const fs = require('fs').promises
const path = require('path')
const chai = require('chai')
const expect = chai.expect
const dirtyChai = require('dirty-chai')

chai.use(dirtyChai)

const JupyterConverter = require('../src/index.js')
const asciidoctor = require('@asciidoctor/core')()

describe('Jupyter converter', () => {
  it('should convert to ipynb', async () => {
    asciidoctor.ConverterFactory.register(JupyterConverter, ['jupyter'])
    const content = await fs.readFile(path.join(__dirname, 'fixtures', 'hello-world.adoc'))
    const result = asciidoctor.convert(content, { backend: 'jupyter' })
    expect(result).is.not.empty()
    const ipynb = JSON.parse(result)
    expect(ipynb.metadata.language_info.name).is.equal('python')
    expect(ipynb.metadata.language_info.version).is.equal('2.7.10')
    expect(ipynb.cells.length).is.equal(35)
    const codeCells = ipynb.cells.filter(cell => cell.cell_type === 'code')
    expect(codeCells.length).is.equal(21)
    expect(codeCells[0].source.join('')).is.equal(`from py2neo import Graph

graph = Graph()`)
    // await fs.writeFile('hello-world.ipynb', result, 'utf8')
    // console.log(util.inspect(ipynb, false, Infinity, true))
  })
  it('should convert an exercise guide to ipynb', async () => {
    asciidoctor.ConverterFactory.register(JupyterConverter, ['jupyter'])
    const inputFile = path.join(__dirname, 'fixtures', 'intro-neo4j-guides-01.adoc')
    const result = asciidoctor.convertFile(inputFile, {
      safe: 'safe',
      backend: 'jupyter',
      to_file: false
    })
    expect(result).is.not.empty()
    const ipynb = JSON.parse(result)
    expect(ipynb.metadata.language_info.name).is.equal('python')
    expect(ipynb.metadata.language_info.version).is.equal('3.9.1')
    expect(ipynb.cells.length).is.equal(20)
    // await fs.writeFile('intro-neo4j-guides-01.ipynb', result, 'utf8')
    // console.log(util.inspect(ipynb, false, Infinity, true))
  })
  it('should convert stem blocks to ipynb', async () => {
    asciidoctor.ConverterFactory.register(JupyterConverter, ['jupyter'])
    const inputFile = path.join(__dirname, 'fixtures', 'lorenz-differential-equations.adoc')
    const result = asciidoctor.convertFile(inputFile, {
      safe: 'safe',
      backend: 'jupyter',
      to_file: false
    })
    expect(result).is.not.empty()
    const ipynb = JSON.parse(result)
    expect(ipynb.metadata.language_info.name).is.equal('python')
    expect(ipynb.metadata.language_info.version).is.equal('3.7.8')
    expect(ipynb.cells.length).is.equal(10)
    // await fs.writeFile('lorenz.ipynb', result, 'utf8')
    // console.log(util.inspect(ipynb, false, Infinity, true))
  })
})
