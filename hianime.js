async function extractEpisodes(url) {
    try {
        const match = url.match(/https:\/\/aniwatchtv\.to\/(.+)$/);
        const encodedID = match[1];
        const [episodesResponse, animeInfoResponse] = await Promise.all([
            fetch(`https://aniwatch-api-one-rosy.vercel.app/aniwatch/episodes/${encodedID}`),
            fetch(`https://aniwatch-api-one-rosy.vercel.app/aniwatch/anime/${encodedID}`)
        ]);
        const episodesData = JSON.parse(episodesResponse);
        const animeInfoData = JSON.parse(animeInfoResponse);
        const animeName = animeInfoData.info.name;

        const transformedResults = episodesData.episodes.map(episode => ({
            href: `https://aniwatchtv.to/${episode.episodeId}?animeName=${encodeURIComponent(animeName)}&episodeNumber=${episode.episodeNo}`,
            number: episode.episodeNo
        }));
        
        return JSON.stringify(transformedResults);
        
    } catch (error) {
        console.log('Fetch error:', error);
    }    
}

async function extractStreamUrl(url) {
    try {
       const urlObj = new URL(url);
       const animeName = decodeURIComponent(urlObj.searchParams.get('animeName'));
       const episodeNumber = urlObj.searchParams.get('episodeNumber');
       
       const match = url.match(/https:\/\/aniwatchtv\.to\/(.+)$/);
       const encodedID = match[1].split('?')[0];
       const response = await fetch(`https://aniwatch-api-one-rosy.vercel.app/aniwatch/episode-srcs?id=${encodedID}&server=vidstreaming&category=sub`);
       const data = JSON.parse(response);
       
       const hlsSource = data.sources.find(source => source.type === 'hls');
        
       let subtitleUrl = null;
       if (animeName && episodeNumber) {
           try {
               const searchResponse = await fetch('https://jimaku.cc/api/entries/search', {
                   headers: { Authorization: 'AAAAAAAABlkuAS5Gu5CmdaJFx5GDWXpl5TGqDsn00SOfknKmwQMPEko-1w' }
               });
               const searchData = await searchResponse.json();
               const entry = searchData.find(entry => 
                   entry.name === animeName || 
                   entry.english_name === animeName ||
                   entry.japanese_name === animeName
               );
               if (entry) {
                   const filesResponse = await fetch(`https://jimaku.cc/api/entries/${entry.id}/files?episode=${episodeNumber}`, {
                       headers: { Authorization: 'AAAAAAAABlkuAS5Gu5CmdaJFx5GDWXpl5TGqDsn00SOfknKmwQMPEko-1w' }
                   });
                   const filesData = await filesResponse.json();
                   const subtitleFile = filesData.find(file => file.url.endsWith('.srt'));
                   subtitleUrl = subtitleFile?.url || null;
               }
           } catch (subError) {
               console.log('Jimaku API error:', subError);
           }
       }
       
       const result = {
           stream: hlsSource?.url || null,
           subtitles: subtitleUrl
       };
       
       return JSON.stringify(result);
    } catch (error) {
        console.log('Fetch error:', error);
        return JSON.stringify({ stream: null, subtitles: null });
    }
}
