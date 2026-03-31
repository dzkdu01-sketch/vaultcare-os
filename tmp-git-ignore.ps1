if (!(git check-ignore -q .worktrees)) {
  Add-Content -Path .gitignore -Value "`n.worktrees/" -Encoding UTF8
  git add .gitignore
  git commit -m "chore: ignore .worktrees directory"
}
