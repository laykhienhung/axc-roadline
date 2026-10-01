# Requirement coverage diff (shared)

Check every spec req has a task section — don't eyeball, diff the `[req-N]` tags:

```sh
d=devspec/changes/<id>
diff <(grep -o '\[req-[0-9]\+\]' $d/spec.md | sort -u) \
     <(grep -o '\[req-[0-9]\+\]' $d/tasks.md | sort -u)
```

- Lines only in `spec.md` = a req with no task section → **capture gap**, flag it.
- Lines only in `tasks.md` = a section citing a req that doesn't exist → flag it too.
- Clean diff = every requirement is covered.
