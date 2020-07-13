import * as vscode from 'vscode'

import BedrockProvider from './Provider'

const selector = [
  { scheme: 'file', language: 'json' }, // regular json
  { scheme: 'file', language: 'jsonc' }, // json with comments
]

const selectorMcfunction = [
  ...selector,
  { scheme: 'file', pattern: '**/*.mcfunction' },
]

export function activate(context: vscode.ExtensionContext) {
  const provider = new BedrockProvider()

  console.log('Congratulations, your extension "vscode-bedrock-definitions" is now active!')

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

  context.subscriptions.push(disposableDefinition, disposableCompletion, disposableLink)
}

export function deactivate() {}
