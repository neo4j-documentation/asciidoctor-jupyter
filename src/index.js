class JupyterConverter {
  constructor (backend) {
    this.backend = backend
    // this.basebackend = 'json'
    this.outfilesuffix = '.ipynb'
    this.filetype = 'json'
  }

  convert (node, transform) {
    const nodeName = transform || node.getNodeName()
    if (nodeName === 'document' || nodeName === 'embedded') {
      const languageName = node.getAttribute('jupyter-language-name', 'python')
      const languageVersion = node.getAttribute('jupyter-language-version', '3.9.1')
      const blocks = node.getBlocks()
      const cells = []
      for (const block of blocks) {
        cells.push(...block.convert())
      }
      const result = {
        cells,
        metadata: {
          language_info: {
            name: languageName,
            version: languageVersion
          }
        },
        nbformat: 4,
        nbformat_minor: 5
      }
      return JSON.stringify(result)
    }
    if (nodeName === 'paragraph') {
      const lines = node.lines
      return lines
        .map(l => node.applySubstitutions(l) + '\n')
    }
    if (nodeName === 'preamble') {
      const blocks = node.getBlocks()
      const lines = blocks.map((b) => b.convert()).filter(v => v.length !== 0).flat()
      lines.unshift('# ' + node.getDocument().getTitle() + '\n', '\n')
      return [{
        cell_type: 'markdown',
        metadata: {
          slideshow: {
            slide_type: 'slide'
          }
        },
        source: lines
      }]
    }
    if (nodeName === 'section') {
      const blocks = node.getBlocks()
      const cells = []
      let lines = []
      for (const block of blocks) {
        if (block.getNodeName() === 'listing') {
          if (lines.length > 0) {
            if (cells.length === 0) {
              lines.unshift('## ' + node.getTitle() + '\n', '\n')
            }
            cells.push({
              cell_type: 'markdown',
              metadata: {
                slideshow: {
                  slide_type: 'slide'
                }
              },
              source: lines
            })
          }
          lines = []
          cells.push(block.convert())
        } else {
          lines.push(...block.convert())
        }
      }
      if (lines.length > 0) {
        if (cells.length === 0) {
          lines.unshift('## ' + node.getTitle() + '\n', '\n')
        }
        cells.push({
          cell_type: 'markdown',
          metadata: {
            slideshow: {
              slide_type: 'slide'
            }
          },
          source: lines
        })
      }
      return cells
    }
    if (nodeName === 'listing') {
      const lines = node.lines
      const length = lines.length
      const source = lines
        .map((l, index) => length === index + 1 ? l : l + '\n')
      return {
        cell_type: 'code',
        metadata: {
          slideshow: {
            slide_type: 'fragment'
          }
        },
        outputs: [],
        source
      }
    }
    if (nodeName === 'inline_anchor') {
      const type = node.getType()
      if (type === 'link') {
        return `[${node.getText()}](${node.getTarget()})`
      }
      // unsupported link type!
      console.warn(`Unsupported inline_anchor type: ${type}, ignoring.`)
      return ''
    }
    if (nodeName === 'inline_quoted') {
      const type = node.getType()
      if (type === 'emphasis' || type === 'monospaced') {
        // nothing to do
        return node.getText()
      } else if (type === 'strong') {
        return `**${node.getText()}**`
      }
      return node.getText()
    }
    if (nodeName === 'inline_image') {
      const image = `![${node.getAttribute('alt')}](${node.getImageUri(node.getTarget())})`
      if (node.hasAttribute('link')) {
        return `[${image}](${node.getAttribute('link')})`
      }
      return image
    }
    if (nodeName === 'image') {
      const image = `![${node.getAttribute('alt')}](${node.getImageUri(node.getAttribute('target'))})`
      if (node.hasAttribute('link')) {
        return [`[${image}](${node.getAttribute('link')})\n`]
      }
      return ['\n', `${image}\n`, '\n']
    }
    if (nodeName === 'ulist' || nodeName === 'olist') {
      const symbol = nodeName === 'ulist' ? '-' : '1.'
      return ['\n', ...node.getItems().map((item) => {
        if (item.hasBlocks()) {
          // depth?
          return item.getContent()
        }
        return `${symbol} ${item.getText()}\n`
      }), '\n']
    }
    console.warn(`Unsupported node: ${nodeName}, ignoring.`)
    return ''
  }
}

module.exports = JupyterConverter
module.exports.register = function (registry) {
  const AsciidoctorModule = registry.$$base_module
  const ConverterFactory = AsciidoctorModule.$$.ConverterFactory
  ConverterFactory.register(JupyterConverter, ['jupyter'])
}
