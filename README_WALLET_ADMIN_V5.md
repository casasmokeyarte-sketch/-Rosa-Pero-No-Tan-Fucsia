# Wallet administration v5

This package adds:

- private, audited product eligibility controls;
- automatic blocking for clearly restricted product names/categories;
- a required NFC UID before linking a physical card;
- a visible internal card reference;
- printable client wallet statements;
- the office action label "DEPOSITAR";
- wallet-api health version 5.

## Important NFC limitation

The Windows reader is exposed as a PC/SC smart-card reader. A normal browser cannot read
that device directly. This package corrects the web workflow and prevents empty card links,
but the UID must still be entered by a local PC/SC bridge. Build and validation of that
local bridge should be handled as a separate installation so the reader model can be tested
without weakening browser or wallet security.

The raw NFC UID is never stored. The server stores only a salted hash. The visible code is
the generated public reference for the card record.

## Product eligibility

Only the private wallet API can change eligibility. Every decision requires a review note,
is linked to an administrator session and is written to an audit table. Automatic restriction
is an additional control and does not replace adult legal, identity or age review.
