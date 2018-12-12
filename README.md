
# MacroText

A text preprocessor with TeX-like syntax and powerful preset macros.
[Live demo](https://ankys.github.io/macrotext2/test.html)

## Examples

```
$ node macrotext.js '\say{Hello, world!}'
-:0:19:Message: message Hello, world!
```

```
$ node macrotext.js '\set_list{a}{1 2}\join{:}{\map{\add{\_}{2}}{\a}}'
3:4
```

And see `test.txt` and `test.html`.

## License

MIT License

Copyright (c) 2018 Atsushi Nakayasu
