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

describe('Jupyter converter', () => {
  it('should convert to ipynb', async () => {
    asciidoctor.ConverterFactory.register(new JupyterConverter(), ['jupyter'])
    const content = await fs.readFile(path.join(__dirname, 'fixtures', 'hello-world.adoc'))
    const result = asciidoctor.convert(content, { backend: 'jupyter'})
    expect(result).is.not.empty()
    const ipynb = JSON.parse(result)
    expect(ipynb.metadata.language_info.name).is.equal("python")
    expect(ipynb.metadata.language_info.version).is.equal("2.7.10")
    //await fs.writeFile('hello-world.ipynb', result, 'utf8')
    //console.log(util.inspect(ipynb, false, Infinity, true))
  })
})

