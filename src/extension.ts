import * as vscode from 'vscode'

import DefinitionProvider from './DefinitionProvider'

export function activate(context: vscode.ExtensionContext) {
  const definitionProvider = new DefinitionProvider()

  console.log('Congratulations, your extension "vscode-bedrock-definitions" is now active!')

  let disposableDefinition = vscode.languages.registerDefinitionProvider([
    { scheme: 'file', language: 'json' }, // regular json
    { scheme: 'file', language: 'jsonc' } // json with comments
  ], definitionProvider)

  context.subscriptions.push(disposableDefinition)
}

export function deactivate() {}
