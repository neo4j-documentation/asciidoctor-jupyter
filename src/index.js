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
          if (node.hasHeader() && node.getDocumentTitle()) {
            if (firstCell && firstCell.cell_type === 'markdown') {
              firstCell.source.unshift(`# ${node.getDocumentTitle()}\n\n`)
            } else {
              cells.push({
                cell_type: 'markdown',
                source: [`# ${node.getDocumentTitle()}\n\n`],
                metadata: {}
              })
            }
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
      const source = node.lines.map(l => node.applySubstitutions(l) + '\n')
      return [{
        cell_type: 'markdown',
        source,
        metadata: {}
      }]
    }
    if (nodeName === 'pass' || nodeName === 'thematic_break') {
      return [] // ignore
    }
    if (nodeName === 'preamble') {
      const blocks = node.getBlocks()
      return blocks.map((b) => b.convert()).filter(v => v.length !== 0).reduce((acc, val) => acc.concat(val), []) // flat Node > 10
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
            if (node.getTitle()) {
              if (firstCell && firstCell.cell_type === 'markdown') {
                firstCell.source.unshift(`## ${node.getTitle()}\n\n`)
              } else {
                cells.push({
                  cell_type: 'markdown',
                  source: [`## ${node.getTitle()}\n\n`],
                  metadata: {}
                })
              }
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
    if (nodeName === 'literal') {
      const lines = node.lines
      const length = lines.length
      const source = lines
        .map((l, index) => length === index + 1 ? l : l + '\n')
      return [{
        cell_type: 'markdown',
        source: ['\n```\n', ...source, '\n```\n'],
        metadata: {}
      }]
    }
    if (nodeName === 'listing') {
      const lines = node.lines
      const length = lines.length
      const source = lines
        .map((l, index) => length === index + 1 ? l : l + '\n')
      const language = node.getAttribute('language')
      if (language === 'python' || language === 'py') {
        return [{
          cell_type: 'code',
          execution_count: 0,
          metadata: {
            slideshow: {
              slide_type: 'fragment'
            }
          },
          outputs: [],
          source
        }]
      } else {
        return [{
          cell_type: 'markdown',
          source: ['```' + language, ...source, '```'],
          metadata: {}
        }]
      }
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
      // make room around a list
      if (cells.length > 0) {
        cells[0].source.unshift('\n')
      }
      if (cells.length > 1) {
        cells[cells.length - 1].source.push('\n')
      }
      return cells
    }
    if (nodeName === 'table') {
      const lines = ['\n']
      const headRows = node.rows.head // getHeadRows()
      const bodyRows = node.rows.body.concat(node.rows.foot) // getBodyRows() | getFootRows()
      if (headRows.length === 0 && bodyRows.length === 0) {
        // empty table!
        return ''
      }
      let headRow
      if (headRows.length === 0) {
        headRow = bodyRows.shift()
      } else {
        headRow = headRows.shift()
      }
      let headLine = '| '
      for (const headCell of headRow) {
        headLine += headCell.$text() + ' | ' // getText()
      }
      lines.push(headLine.trim() + '\n')
      lines.push('| ' + headRow.map(c => '-'.repeat(c.$text().length)).join(' | ') + ' |\n') // getText()
      if (headRows && headRows.length > 0) {
        for (const headRow of headRows) {
          let line = '| '
          for (const headCell of headRow) {
            line += headCell.$text() + ' | ' // getText()
          }
          line = line.trim() + '\n'
          lines.push(line)
        }
      }
      if (bodyRows && bodyRows.length > 0) {
        for (const bodyRow of bodyRows) {
          let line = '| '
          for (const cell of bodyRow) {
            line += cell.$text() + ' | ' // getText()
          }
          line = line.trim() + '\n'
          lines.push(line)
        }
      }
      lines.push('\n')
      return [{
        cell_type: 'markdown',
        source: lines,
        metadata: {}
      }]
    }
    if (nodeName === 'quote') {
      const cells = []
      let lastCell = {}
      const blocks = node.getBlocks()
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
      return cells.map(cell => {
        if (cell.cell_type === 'markdown') {
          cell.source = cell.source.map(l => `> ${l}`)
          cell.source.unshift('\n')
          cell.source.push('\n')
        }
        return cell
      })
    }
    if (nodeName === 'admonition') {
      const cells = []
      cells.push({
        cell_type: 'markdown',
        source: [`*${node.getAttribute('textlabel')}:* `],
        metadata: {}
      }
      )
      let lastCell = {}
      if (node.hasBlocks()) {
        const blocks = node.getBlocks()
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
      } else {
        cells[0].source[0] += node.getContent() + '\n'
      }
      return cells
    }
    // inline
    if (nodeName === 'inline_break') {
      return '\n'
    }
    if (nodeName === 'inline_anchor') {
      const type = node.getType()
      if (type === 'link') {
        return `[${node.getText()}](${node.getTarget()})`
      }
      // unsupported link type!
      logger.warn(`Unsupported inline_anchor type: ${type}, ignoring.`)
      return ''
    }
    if (nodeName === 'inline_quoted') {
      const type = node.getType()
      if (type === 'emphasis') {
        return `*${node.getText()}*`
      }
      if (type === 'monospaced') {
        return `\`${node.getText()}\``
      }
      if (type === 'strong') {
        return `**${node.getText()}**`
      }
      if (type === 'asciimath') {
        return `\\\\(${node.getText()}\\\\)`
      }
      if (type === 'unquoted') {
        return node.getText()
      }
      logger.info(`Unsupported inline type: ${type}, using raw text.`)
      return node.getText()
    }
    if (nodeName === 'inline_image') {
      const image = `![${node.getAttribute('alt')}](${node.getImageUri(node.getTarget())})`
      if (node.hasAttribute('link')) {
        return `[${image}](${node.getAttribute('link')})`
      }
      return image
    }

    logger.warn(`Unsupported node: ${nodeName}, ignoring.`)
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
    if (result) {
      if (!result.find(cell => cell.cell_type !== 'markdown')) {
        lastCell.source.push(...result.reduce((acc, cell) => acc.concat(cell.source), [])) // flatMap Node > 11
      } else {
        const adjacentMarkdownCells = []
        const remainingCells = []
        let adjacentCells = true
        for (const cell of result) {
          if (adjacentCells && cell.cell_type === 'markdown') {
            adjacentMarkdownCells.push(cell)
          } else {
            remainingCells.push(cell)
            adjacentCells = false
          }
        }
        lastCell.source.push(...adjacentMarkdownCells.reduce((acc, cell) => acc.concat(cell.source), [])) // flatMap Node > 11
        if (remainingCells.length > 0) {
          cells.push(...remainingCells)
          lastCell = cells[cells.length - 1]
        }
      }
    }
    return lastCell
  }
}

let logger = console

module.exports = JupyterConverter
module.exports.register = function (registry, context) {
  let AsciidoctorModule
  if (registry.$$meta && registry.$$meta.$$is_class) {
    // registry is a class
    AsciidoctorModule = registry.$$base_module
  } else {
    // instance
    AsciidoctorModule = registry.$$class.$$base_module.$$base_module
  }
  if (context && context.logger) {
    logger = context.logger
  } else if (AsciidoctorModule.LoggerManager) {
    logger = AsciidoctorModule.LoggerManager.getLogger()
  }
  let ConverterFactory
  if (typeof AsciidoctorModule.ConverterFactory !== 'undefined') {
    // Asciidoctor.js >= 2
    ConverterFactory = AsciidoctorModule.ConverterFactory
  } else {
    // Asciidoctor.js < 2
    ConverterFactory = AsciidoctorModule.$$.ConverterFactory
  }
  ConverterFactory.register(JupyterConverter, ['jupyter'])
}
