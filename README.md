# github-action-pr-list
List pull request and filter them by label and/or if the checks are passing.

# Usage

See [action.yaml](action.yaml)

Basic:
```yaml
steps:
- name: Checkout Code
  uses: actions/checkout@master

- name: Retrive PRs
  uses: ./.github/actions/pr-list
  id: prlist
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    labels: '["dependencies"]'
    checkStatus: 'true'

- name: Get the output
  run: echo "THere are ${{ steps.prlist.outputs.count }} PRs"
```
