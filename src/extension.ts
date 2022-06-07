import * as vscode from 'vscode'

import BedrockProvider from './Provider'

import { cleanJson, log } from './lib/util'

const selector = [
  { scheme: 'file', language: 'json' }, // regular json
  { scheme: 'file', language: 'jsonc' }, // json with comments
]

const selectorMcfunction = [
  ...selector,
  { scheme: 'file', pattern: '**/*.mcfunction' },
]

async function isBedrockWorkspace () {
  let isBedrockWorkspace = false

  // a very basic check to find a manifest with the bedrock-only `format_version` and header
  const manifestPossibilities = await vscode.workspace.findFiles('**/manifest.json')
  for (let file of manifestPossibilities) {
    const content = (await vscode.workspace.openTextDocument(file)).getText()
    const json = cleanJson(content)
    const keys = Object.keys(json)
    isBedrockWorkspace = keys.includes('header') && keys.includes('format_version')
  }

  return isBedrockWorkspace
}

export async function activate(context: vscode.ExtensionContext) {
  // only enable if bedrock workspace
  if (!(await isBedrockWorkspace())) {
    log('Could not find a `manifest.json`. Bedrock Definitions\' functionality has been disabled.')
    return
  }

  log('Now active')

  const provider = new BedrockProvider()

  let disposableDefinition = vscode.languages.registerDefinitionProvider(
    selector,
    provider,
  )

  let disposableCompletion = vscode.languages.registerCompletionItemProvider(
    selectorMcfunction,
    provider,
    '.', ':', '/', '=' // activate when typing a period, colon, forward slash, or equals (for commands)
  )

  let disposableLink = vscode.languages.registerDocumentLinkProvider(
    selectorMcfunction,
    provider
  )

  const documentDisposables = provider.documentDisposables()

  const disposableCommand = vscode.commands.registerCommand('bedrock-definitions.refreshCache', () => provider.purgeCache())

  context.subscriptions.push(disposableDefinition, disposableCompletion, disposableLink, ...documentDisposables, disposableCommand)
}

export function deactivate() {}
