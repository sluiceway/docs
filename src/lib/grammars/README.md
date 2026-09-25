# Grammars

TextMate grammars for languages the action's docs fence that Shiki's bundle does not have. `src/lib/code-theme.ts` hands them to Expressive Code.

| File | Language | From | Licence |
| --- | --- | --- | --- |
| `rego.tmLanguage.json` | Rego, the policies page | `syntaxes/Rego.tmLanguage` of [open-policy-agent/vscode-opa](https://github.com/open-policy-agent/vscode-opa) at v0.25.0, converted from its plist with `plutil -convert json`, its `name` set to `rego` (the fence's word) in place of `Rego`, and `uuid` left out | Apache-2.0 |

To update one, fetch the file at a release tag, convert it the same way, and say the tag here.
