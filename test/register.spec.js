/* global describe it */
const fs = require('fs').promises
const path = require('path')
const chai = require('chai')
const expect = chai.expect
const dirtyChai = require('dirty-chai')

chai.use(dirtyChai)

const { register: registerJupyterConverter } = require('../src/index.js')
const asciidoctor = require('@asciidoctor/core')()

describe('Jupyter converter', () => {
  it('should register the converter', async () => {
    // this function is called by Asciidoctor.js CLI
    registerJupyterConverter(asciidoctor.Extensions)
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
  it('should send logs through Asciidoctor logger', async () => {
    const loggerManager = asciidoctor.LoggerManager
    const memoryLogger = asciidoctor.MemoryLogger.create()
    loggerManager.setLogger(memoryLogger)
    // this function is called by Asciidoctor.js CLI
    registerJupyterConverter(asciidoctor.Extensions)
    const content = await fs.readFile(path.join(__dirname, 'fixtures', 'unsupported-syntax.adoc'))
    const result = asciidoctor.convert(content, { backend: 'jupyter' })
    expect(result).is.not.empty()
    expect(memoryLogger.getMessages().map(msg => ({ severity: msg.getSeverity(), message: msg.getText() }))).to.deep.equals([
      {
        severity: 'INFO',
        message: 'Unsupported inline type: subscript, using raw text.'
      },
      {
        severity: 'INFO',
        message: 'Unsupported inline type: superscript, using raw text.'
      }
    ])
  })
})
