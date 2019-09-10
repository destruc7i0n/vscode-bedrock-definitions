import * as vscode from 'vscode'

import DefinitionProvider from './providers/DefinitionProvider'
import CompletionProvider from './providers/CompletionProvider'

export function activate(context: vscode.ExtensionContext) {
  const definitionProvider = new DefinitionProvider()
  const completionProvider = new CompletionProvider()

  console.log('Congratulations, your extension "vscode-bedrock-definitions" is now active!')

  let disposableDefinition = vscode.languages.registerDefinitionProvider([
    { scheme: 'file', language: 'json' }, // regular json
    { scheme: 'file', language: 'jsonc' } // json with comments
  ], definitionProvider)

  let disposableCompletion = vscode.languages.registerCompletionItemProvider([
    { scheme: 'file', language: 'json' }, // regular json
    { scheme: 'file', language: 'jsonc' } // json with comments
  ], completionProvider, '.', ':', '/') // activate when typing a period, colon, or forward slash

  context.subscriptions.push(disposableDefinition, disposableCompletion)
}

export function deactivate() {}
