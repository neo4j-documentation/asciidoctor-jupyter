/* global describe it */
const util = require('util')
const fs = require('fs').promises
const path = require('path')
const chai = require('chai')
const expect = chai.expect
const dirtyChai = require('dirty-chai')

chai.use(dirtyChai)

const JupyterConverter = require('../src/index.js')
const asciidoctor = require('@asciidoctor/core')()

const debug = async (result, path) => {
  if (process.env.DEBUG) {
    if (path) {
      await fs.writeFile(path, result, 'utf8')
    }
    const ipynb = JSON.parse(result)
    console.log(util.inspect(ipynb, false, Infinity, true))
  }
}

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
    await debug(result, 'lorenz-differential-equations.ipynb')
  })
  it('should convert an exercise guide with a complex list to ipynb', async () => {
    asciidoctor.ConverterFactory.register(JupyterConverter, ['jupyter'])
    const inputFile = path.join(__dirname, 'fixtures', 'list-continuation.adoc')
    const result = asciidoctor.convertFile(inputFile, {
      safe: 'safe',
      backend: 'jupyter',
      to_file: false
    })
    expect(result).is.not.empty()
    const ipynb = JSON.parse(result)
    expect(ipynb.metadata.language_info.name).is.equal('python')
    expect(ipynb.metadata.language_info.version).is.equal('3.9.1')
    expect(ipynb.cells.length).is.equal(6)
    await debug(result, 'list-continuation.ipynb')
  })
  it('should convert an exercise guide with a inline style list to ipynb', async () => {
    asciidoctor.ConverterFactory.register(JupyterConverter, ['jupyter'])
    const inputFile = path.join(__dirname, 'fixtures', 'inline-style.adoc')
    const result = asciidoctor.convertFile(inputFile, {
      safe: 'safe',
      backend: 'jupyter',
      to_file: false
    })
    expect(result).is.not.empty()
    const ipynb = JSON.parse(result)
    expect(ipynb.metadata.language_info.name).is.equal('python')
    expect(ipynb.metadata.language_info.version).is.equal('3.9.1')
    expect(ipynb.cells.length).is.equal(1)
    expect(ipynb.cells[0].source[0]).is.equal('For all query tuning measurements, you must always run the query twice.\n')
  })
  it('should convert an exercise guide with a table to ipynb', async () => {
    asciidoctor.ConverterFactory.register(JupyterConverter, ['jupyter'])
    const inputFile = path.join(__dirname, 'fixtures', 'table.adoc')
    const result = asciidoctor.convertFile(inputFile, {
      safe: 'safe',
      backend: 'jupyter',
      to_file: false
    })
    expect(result).is.not.empty()
    const ipynb = JSON.parse(result)
    expect(ipynb.metadata.language_info.name).is.equal('python')
    expect(ipynb.metadata.language_info.version).is.equal('3.9.1')
    expect(ipynb.cells.length).is.equal(1)
    expect(ipynb.cells[0].source.join('')).is.equal(`## Exercise 5.2: Determine how large the datasets are that you will be loading. (Instructions)

The datasets containing the normalized data are at these locations:

| Dataset | URL |
| ------- | --- |
| Movies | [https://data.neo4j.com/advanced-cypher/movies1.csv](https://data.neo4j.com/advanced-cypher/movies1.csv) |
| People | [https://data.neo4j.com/advanced-cypher/people.csv](https://data.neo4j.com/advanced-cypher/people.csv) |
| Roles | [https://data.neo4j.com/advanced-cypher/roles.csv](https://data.neo4j.com/advanced-cypher/roles.csv) |
| Directors | [https://data.neo4j.com/advanced-cypher/directors.csv](https://data.neo4j.com/advanced-cypher/directors.csv) |

**Write Cypher code to return the number of lines in each of these CSV files.**
`)
  })
})
