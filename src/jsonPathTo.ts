// Used from https://github.com/nidu/vscode-copy-json-path

export enum ColType { Object, Array }
interface Frame {
  colType: ColType
  index?: number
  key?: string
}

export function jsonPathTo(text: string, offset: number) {
  let pos = 0
  let stack: Frame[] = []
  let isInKey = false

  while (pos < offset) {
    const startPos = pos
    switch (text[pos]) {
      case '"':
        const { text: s, pos: newPos } = readString(text, pos)
        if (stack.length) {
          const frame = stack[stack.length - 1]
          if (frame.colType == ColType.Object && isInKey) {
            frame.key = s
            isInKey = false
          }
        }
        pos = newPos
        break
      case '{':
        stack.push({ colType: ColType.Object })
        isInKey = true
        break
      case '[':
        stack.push({ colType: ColType.Array, index: 0 })
        break
      case '}':
      case ']':
        stack.pop()
        break
      case ',':
        if (stack.length) {
          const frame = stack[stack.length - 1]
          if (frame.colType == ColType.Object) {
            isInKey = true
          } else {
            if (frame.index) frame.index++
          }
        }
        break
    }
    if (pos == startPos) {
      pos++
    }
  }

  return stack
}

function readString(text: string, pos: number): { text: string, pos: number } {
  let i = pos + 1
  i = findEndQuote(text, i)
  return {
    text: text.substring(pos + 1, i),
    pos: i + 1
  }
}

// Find the next end quote
function findEndQuote(text: string, i: number) {
  while (i < text.length) {
    if (text[i] == '"') {
      var bt = i

      // Handle backtracking to find if this quote is escaped (or, if the escape is escaping a slash)
      while (0 <= bt && text[bt] == '\\') {
        bt--
      }
      if ((i - bt) % 2 === 0) {
        break;
      }
    }
    i++
  }

  return i
}
