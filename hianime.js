async function extractStreamUrl(url) {
    try {
        // 1. Extract Aniwatch episode ID
        const match = url.match(/https:\/\/aniwatchtv\.to\/(.+)$/);
        const encodedID = match[1];
        
        // 2. Get stream URL from Aniwatch
        const srcResponse = await fetch(`https://aniwatch-api-one-rosy.vercel.app/aniwatch/episode-srcs?id=${encodedID}&server=vidstreaming&category=sub`);
        const srcData = JSON.parse(srcResponse);
        const hlsSource = srcData.sources.find(source => source.type === 'hls');

        // 3. Get episode number from URL
        const urlObj = new URL(url);
        const episodeNumber = urlObj.searchParams.get('episode');

        // 4. Get anime metadata from Aniwatch
        const animeId = encodedID.split('-')[0]; // Adjust based on actual ID structure
        const animeResponse = await fetch(`https://aniwatch-api-one-rosy.vercel.app/aniwatch/anime/${animeId}`);
        const animeData = JSON.parse(animeResponse);

        // 5. Search Jimaku using AniList ID from Aniwatch data
        let jimakuEntry;
        if (animeData.info.anilist_id) {
            const jimakuSearch = await fetch(`https://jimaku.cc/api/entries/search?anilist_id=${animeData.info.anilist_id}`, {
                headers: { 'Authorization': 'Bearer AAAAAAAABlkuAS5Gu5CmdaJFx5GDWXpl5TGqDsn00SOfknKmwQMPEko-1w' }
            });
            const jimakuData = JSON.parse(jimakuSearch);
            jimakuEntry = jimakuData[0];
        }

        // 6. Fallback to title search if AniList ID missing
        if (!jimakuEntry) {
            const titleSearch = await fetch(`https://jimaku.cc/api/entries/search?query=${encodeURIComponent(animeData.info.name)}`, {
                headers: { 'Authorization': 'Bearer AAAAAAAABlkuAS5Gu5CmdaJFx5GDWXpl5TGqDsn00SOfknKmwQMPEko-1w' }
            });
            jimakuEntry = JSON.parse(titleSearch)[0];
        }

        // 7. Get subtitles for episode
        let subtitleUrl = null;
        if (jimakuEntry) {
            const filesResponse = await fetch(`https://jimaku.cc/api/entries/${jimakuEntry.id}/files?episode=${episodeNumber}`, {
                headers: { 'Authorization': 'Bearer AAAAAAAABlkuAS5Gu5CmdaJFx5GDWXpl5TGqDsn00SOfknKmwQMPEko-1w' }
            });
            const files = JSON.parse(filesResponse);
            const subFile = files.find(f => f.name.endsWith('.vtt'));
            subtitleUrl = subFile?.url;
        }

        return JSON.stringify({
            stream: hlsSource?.url || null,
            subtitles: subtitleUrl
        });

    } catch (error) {
        console.log('Fetch error:', error);
        return JSON.stringify({ stream: null, subtitles: null });
    }
}
