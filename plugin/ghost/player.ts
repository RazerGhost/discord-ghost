/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 RazerGhost
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// What's playing on the user's Spotify, read from Discord's own SpotifyStore
// (fed by Discord's Spotify connection; the same store that drives the
// "Listening to Spotify" activity). It always holds the current track, also one
// that was already playing when Discord started. Vencord's SpotifyControls store
// only learns about tracks from events after it's first used, so it's only used
// for the interpolated playback position.
// Shared by the background and accent, and shaped like spicetify-ghost's
// player.ts so its lyrics providers can be ported on top of it later.

import { SpotifyStore as PlayerPosition } from "@plugins/spotifyControls/SpotifyStore";
import { FluxDispatcher, SpotifyStore } from "@webpack/common";

/** The current track, as the lyrics code (spicetify-ghost/src/lyrics) needs it. */
export type TrackInfo = {
    uri: string;
    /** Spotify track id; undefined for local files. */
    id?: string;
    title: string;
    artist: string;
    album: string;
    /** Seconds. */
    duration: number;
    /** Cover image URL (i.scdn.co, which sends Access-Control-Allow-Origin: *). */
    image?: string;
};

const storeTrack = () => SpotifyStore?.getTrack() ?? null;

export const albumArt = (): string | undefined => storeTrack()?.album?.image?.url || undefined;

/** Playback position in seconds (interpolated between Spotify's updates). Only
 *  known after the first player update since Ghost started. */
export const position = () => PlayerPosition.position / 1000;

export function currentTrack(): TrackInfo | null {
    const track = storeTrack();
    if (!track) return null;
    return {
        uri: `spotify:${track.type ?? "track"}:${track.id}`,
        id: track.isLocal ? undefined : track.id,
        title: track.name,
        artist: track.artists?.[0]?.name ?? "",
        album: track.album?.name ?? "",
        duration: track.duration / 1000,
        image: albumArt(),
    };
}

/** Run `cb` whenever the track (or its cover) changes, and once right away.
 *
 *  Discord loads its SpotifyStore lazily, possibly after Ghost starts, so
 *  Vencord's `SpotifyStore` export can still be undefined here. Listen on the
 *  dispatcher instead (always there), and look again once a second until the
 *  store exists: it then already holds the track that's playing.
 *  Player updates also fire on seek, pause, volume…; this filters those out.
 *  Returns an unsubscribe function. */
export function onTrackChange(cb: () => void): () => void {
    let last: string | null = null;
    const check = () => {
        const track = storeTrack();
        const key = track ? `${track.id}|${albumArt()}` : "";
        if (key === last) return;
        last = key;
        cb();
    };
    // After the store has handled the event, not before.
    const onPlayerState = () => setTimeout(check);
    FluxDispatcher.subscribe("SPOTIFY_PLAYER_STATE", onPlayerState);

    let tries = 0;
    const waitForStore = setInterval(() => {
        if (SpotifyStore || ++tries > 60) clearInterval(waitForStore);
        check();
    }, 1000);
    check();

    return () => {
        clearInterval(waitForStore);
        FluxDispatcher.unsubscribe("SPOTIFY_PLAYER_STATE", onPlayerState);
    };
}
