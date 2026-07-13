// Build tag shown in the top bar. Bump on every published build — its whole
// purpose is letting a player (or a bug report) confirm WHICH build they're
// actually running, since the published Artifact keeps the same URL forever
// and a browser can silently serve a stale cached copy long after a fix
// shipped. "The bug still happens" plus an old tag on screen = cache, not
// code.
export const GAME_BUILD = '2026-07-13d';
