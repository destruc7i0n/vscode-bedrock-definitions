import * as vscode from 'vscode'

import BedrockProvider from './Provider'

import { cleanJson } from './lib/util'

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
  console.log('Congratulations, your extension "vscode-bedrock-definitions" is now active!')

  // only enable if bedrock workspace
  if (!(await isBedrockWorkspace())) {
    console.log('Could not find a `manifest.json`. Bedrock Definitions\' functionality has been disabled.')
  }

  const provider = new BedrockProvider()

  let disposableDefinition = vscode.languages.registerDefinitionProvider(
    selector,
    provider,
  )

  let disposableCompletion = vscode.languages.registerCompletionItemProvider(
    selectorMcfunction,
    provider,
    '.', ':', '/' // activate when typing a period, colon, or forward slash
  )

  let disposableLink = vscode.languages.registerDocumentLinkProvider(
    selectorMcfunction,
    provider
  )

  const disposableSave = provider.onDocumentSaved()

  const disposableCommand = vscode.commands.registerCommand('bedrock-definitions.refreshCache', () => provider.purgeCache())

  context.subscriptions.push(disposableDefinition, disposableCompletion, disposableLink, disposableSave, disposableCommand)
}

export function deactivate() {}
