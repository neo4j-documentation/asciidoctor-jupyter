const InlineImplicitLinkRegex = /((?:https?|file|ftp|irc):\/\/[^\s[\]<]*)(?:\[(.*)])?/
const InlineLinkRegex = /link:(.*)\[(.*)]/

class JupyterConverter {
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
    } else if (nodeName === 'paragraph') {
      const lines = node.lines
      const length = lines.length
      return node.lines
        .map(l => this.convertAsciiDocToMarkdown(l))
        .map((l, index) => length === index + 1 ? l : l + '\n')
    } else if (nodeName === 'preamble') {
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
    } else if (nodeName === 'section') {
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
    } else if (nodeName === 'listing') {
      const lines = node.lines
      const length = lines.length
      const source = node.lines
        .map(l => this.convertAsciiDocToMarkdown(l))
        .map((l, index) => length === index + 1 ? l : l + '\n')
      return {
        cell_type: 'code',
        metadata: {
          collapsed: false,
          slideshow: {
            slide_type: 'fragment'
          }
        },
        outputs: [],
        source
      }
    }
    console.warn(`Unsupported node: ${nodeName}, ignoring.`)
    return ''
  }

  convertAsciiDocToMarkdown (line) {
    const linkFound = line.match(InlineLinkRegex)
    if (linkFound) {
      const link = linkFound[1]
      const target = linkFound[2]
      return `[${target}](${link})`
    }
    const implicitLinkFound = line.match(InlineImplicitLinkRegex)
    if (implicitLinkFound) {
      const link = implicitLinkFound[1]
      const target = implicitLinkFound[2]
      return `[${target}](${link})`
    }
    return line
  }
}

module.exports = JupyterConverter
module.exports.register = function (registry) {
  const AsciidoctorModule = registry.$$base_module
  const ConverterFactory = AsciidoctorModule.$$.ConverterFactory
  ConverterFactory.register(new JupyterConverter(), ['jupyter'])
}
