import * as vscode from 'vscode'
import { sep as pathSep } from 'path'

import { Node, findNodeAtLocation } from 'jsonc-parser'
import { ResourceFilePackType } from '../handlers/FileHandler'

/**
 * Construct completion item
 * @param text 
 * @param range 
 * @param kind 
 * @param doc
 */
function getCompletionItem (text: string, range: vscode.Range, kind: vscode.CompletionItemKind = vscode.CompletionItemKind.Value, doc?: string): vscode.CompletionItem {
  const item = new vscode.CompletionItem(text)
  item.kind = kind
  item.insertText = text
  item.range = range
  if (doc) item.documentation = doc
  return item
}

/**
 * Return a link to a file based on URI
 * @param file the uri
 * @param range range of the text
 */
function getDocumentLink (file: vscode.Uri, range: vscode.Range, tooltip?: string) {
  const uri = vscode.Uri.file(file.path)
  const link =  new vscode.DocumentLink(range, uri)
  if (tooltip) link.tooltip = tooltip
  return link
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

/**
 * Converts the node to a range in the document provided
 * @param node the node
 * @param document the document
 */
function nodeToRange (node: Node, document: vscode.TextDocument): vscode.Range {
  const offset = node.offset
  const start = document.positionAt(offset + 1)
  const end = document.positionAt(offset + (node.length - 1))
  return new vscode.Range(start, end)
}

/**
 * Basic logger
 * @param args to log
 */
function log (...args: any) {
  console.log('[Bedrock Definitions]', ...args)
}

/**
 * Returns a range from the given json path
 * @param node 
 * @param path 
 * @param document 
 */
function getRangeFromPath (node: Node, path: (string | number)[], document: vscode.TextDocument) {
  const pointer = findNodeAtLocation(node, path)
  if (pointer) {
    return nodeToRange(pointer, document)
  }
}

/**
 * Remove the ending quote from a string
 * @param string 
 */
function removeEndingQuote (string: string) {
  if (string.endsWith('"')) return string.slice(0, -1)
  return string
}

/**
 * attempt to determine the pack type from the file path
 * @param doc vscode.TextDocument
 * @returns 
 */
function guessPackTypeFromDocument(doc: vscode.TextDocument): ResourceFilePackType {
  const documentPath = doc.uri.fsPath

  // check for either development or the world packs folder in the path
  const hasPacksFolderInPath = (folder: string) =>
    documentPath.includes(`${pathSep}development_${folder}${pathSep}`) ||
    documentPath.includes(`${pathSep}${folder}${pathSep}`)

  if (hasPacksFolderInPath('behavior_packs')) return ResourceFilePackType.Behaviour
  else if (hasPacksFolderInPath('resource_packs')) return ResourceFilePackType.Resource
  return ResourceFilePackType.Unknown
}

export {
  getCompletionItem,
  cleanJson,
  getDocumentLink,
  nodeToRange,
  getRangeFromPath,
  removeEndingQuote,
  guessPackTypeFromDocument,
  log
}
