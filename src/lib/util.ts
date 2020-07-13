import * as vscode from 'vscode'

function getCompletionItem (text: string, range: vscode.Range, description?: string, insertText?: string): vscode.CompletionItem {
  const item = new vscode.CompletionItem(text)
  item.kind = vscode.CompletionItemKind.Value
  item.detail = description
  item.insertText = insertText ? insertText : text
  item.range = range
  return item
}

/**
 * Return a link to a file based on URI
 * @param file the uri
 * @param range range of the text
 */
function getDocumentLink (file: vscode.Uri, range: vscode.Range) {
  const uri = vscode.Uri.file(file.path)
  return new vscode.DocumentLink(range, uri)
}

/**
 * Cleans any comments from the file
 * @param data the content of the file
 */
function cleanJson (data: string) {
  data = data.replace(/\/\*[^(\*\/)]*\*\/|\/\/.*/g, '')

  try {
    const json = JSON.parse(data)
    return json
  } catch (e) {}
}

export { getCompletionItem, cleanJson, getDocumentLink }
