import * as vscode from 'vscode';

export class CldtDefinitionProvider implements vscode.DefinitionProvider {
    provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Definition | vscode.LocationLink[]> {
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return undefined;
        }

        const word = document.getText(wordRange);
        
        // Search for variable or overlay definitions in the document
        const text = document.getText();
        const lines = text.split('\n');
        
        // Look for definitions like "variable: name = value" or "overlay: name { ... }"
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const regex = new RegExp(`\\b(variable|overlay|underlay)\\s*:\\s*${word}\\b`);
            const match = regex.exec(line);
            
            if (match) {
                const position = new vscode.Position(i, match.index);
                const range = new vscode.Range(position, position);
                return new vscode.Location(document.uri, range);
            }
        }

        return undefined;
    }
}


