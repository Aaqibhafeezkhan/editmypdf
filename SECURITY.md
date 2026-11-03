# Security

Edit My PDF runs entirely in the browser: pdf.js parses the file in a web worker, pdf-lib writes
the new one in the same tab, and sessions live in the browser's own storage. There is no server
that holds documents, so most of what could go wrong is in the page itself: a crafted PDF that
breaks the parser, a cross-site scripting path through text drawn from a document, or a dependency
with a known problem.

If you find something like that, please report it privately rather than in a public issue:
open **Security → Report a vulnerability** on the repository. You will get a reply within a week,
and credit in the fix if you want it. Please do not test against other people's documents or
sessions; a local build (`npm run dev`) gives you everything the live site has.
