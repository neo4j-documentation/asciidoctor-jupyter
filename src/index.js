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
        const result = block.convert()
        if (cells.length === 0) {
          const firstCell = result[0]
          // attach document title
          if (firstCell.cell_type === 'markdown') {
            firstCell.source.unshift(`# ${node.getTitle()}\n\n`)
          } else {
            cells.push({
              cell_type: 'markdown',
              source: [`# ${node.getTitle()}\n\n`],
              metadata: {}
            })
          }
        }
        cells.push(...result)
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
        nbformat_minor: 4
      }
      return JSON.stringify(result)
    }
    if (nodeName === 'paragraph') {
      return [{
        cell_type: 'markdown',
        source: node.lines.map(l => node.applySubstitutions(l) + '\n'),
        metadata: {}
      }]
    }
    if (nodeName === 'preamble') {
      const blocks = node.getBlocks()
      return blocks.map((b) => b.convert()).filter(v => v.length !== 0).flat()
    }
    if (nodeName === 'section') {
      const blocks = node.getBlocks()
      const cells = []
      let lastCell = {}
      for (const block of blocks) {
        const result = block.convert()
        // merge adjacent cells with the same type
        if (lastCell.cell_type === 'markdown') {
          lastCell = this.mergeAdjacentMarkdownCells(result, lastCell, cells)
        } else {
          if (cells.length === 0) {
            const firstCell = result[0]
            // attach section title
            if (firstCell.cell_type === 'markdown') {
              firstCell.source.unshift(`## ${node.getTitle()}\n\n`)
            } else {
              cells.push({
                cell_type: 'markdown',
                source: [`## ${node.getTitle()}\n\n`],
                metadata: {}
              })
            }
          }
          cells.push(...result)
          lastCell = cells[cells.length - 1]
        }
      }
      return cells
    }
    if (nodeName === 'stem') {
      return [{
        cell_type: 'markdown',
        source: [`\n$$\n${node.lines.join('\n')}\n$$\n`],
        metadata: {}
      }]
    }
    if (nodeName === 'listing') {
      const lines = node.lines
      const length = lines.length
      const source = lines
        .map((l, index) => length === index + 1 ? l : l + '\n')
      return [{
        cell_type: 'code',
        metadata: {
          slideshow: {
            slide_type: 'fragment'
          }
        },
        outputs: [],
        source
      }]
    }
    if (nodeName === 'image') {
      const image = `![${node.getAttribute('alt')}](${node.getImageUri(node.getAttribute('target'))})`
      if (node.hasAttribute('link')) {
        return [`[${image}](${node.getAttribute('link')})\n`]
      }
      return [{
        cell_type: 'markdown',
        source: ['\n', `${image}\n`, '\n'],
        metadata: {}
      }]
    }
    if (nodeName === 'ulist' || nodeName === 'olist') {
      const symbol = nodeName === 'ulist' ? '-' : '1.'
      const lines = []
      let lastCell = {}
      const cells = []
      for (const item of node.getItems()) {
        cells.push({
          cell_type: 'markdown',
          source: [`${symbol} ${item.getText()}\n`],
          metadata: {}
        })
        if (item.hasBlocks()) {
          const blocks = item.getBlocks()
          for (const block of blocks) {
            const result = block.convert()
            // merge adjacent cells with the same type
            if (lastCell.cell_type === 'markdown') {
              lastCell = this.mergeAdjacentMarkdownCells(result, lastCell, cells)
            } else {
              cells.push(...result)
              lastCell = cells[cells.length - 1]
            }
          }
        }
      }
      return cells
    }
    // inline
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
      }
      if (type === 'strong') {
        return `**${node.getText()}**`
      }
      if (type === 'asciimath') {
        return `\\\\(${node.getText()}\\\\)`
      }
      console.log(type)
      return node.getText()
    }
    if (nodeName === 'inline_image') {
      const image = `![${node.getAttribute('alt')}](${node.getImageUri(node.getTarget())})`
      if (node.hasAttribute('link')) {
        return `[${image}](${node.getAttribute('link')})`
      }
      return image
    }

    console.warn(`Unsupported node: ${nodeName}, ignoring.`)
    return ''
  }

  /**
   * Merge adjacent cells with the same type
   * @param result
   * @param lastCell
   * @param cells
   * @returns lastCell
   */
  mergeAdjacentMarkdownCells (result, lastCell, cells) {
    if (!result.find(cell => cell.cell_type !== 'markdown')) {
      lastCell.source.push(...result.flatMap(cell => cell.source))
    } else {
      const adjacentMarkdownCells = []
      const remainingCells = []
      for (const cell of result) {
        if (cell.cell_type === 'markdown') {
          adjacentMarkdownCells.push(cell)
        } else {
          remainingCells.push(cell)
        }
      }
      lastCell.source.push(...adjacentMarkdownCells.flatMap(cell => cell.source))
      if (remainingCells.length > 0) {
        cells.push(...remainingCells)
        lastCell = cells[cells.length - 1]
      }
    }
    return lastCell
  }
}

module.exports = JupyterConverter
module.exports.register = function (registry) {
  const AsciidoctorModule = registry.$$base_module
  const ConverterFactory = AsciidoctorModule.$$.ConverterFactory
  ConverterFactory.register(JupyterConverter, ['jupyter'])
}
