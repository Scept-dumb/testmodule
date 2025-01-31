async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        // Changed to sub
        const responseText = await fetch(`https://api.animemundo.net/api/v2/hianime/search?q=${encodedKeyword}&language=sub`);
        const data = JSON.parse(responseText);

        // Changed to sub
        const filteredAnimes = data.data.animes.filter(anime => anime.episodes.sub !== null);
        
        const transformedResults = data.data.animes.map(anime => ({
            title: anime.name,
            image: anime.poster,
            href: `https://hianime.to/watch/${anime.id}`
        }));
        
        return JSON.stringify(transformedResults);
        
    } catch (error) {
        console.log('Fetch error:', error);
        return JSON.stringify([{ title: 'Error', image: '', href: '' }]);
    }
}

async function extractEpisodes(url) {
    try {
        const match = url.match(/https:\/\/hianime\.to\/watch\/(.+)$/);
        const encodedID = match[1];
        const response = await fetch(`https://api.animemundo.net/api/v2/hianime/anime/${encodedID}/episodes`);
        const data = JSON.parse(response);

        const transformedResults = data.data.episodes.map(episode => ({
            // Changed url
            href: `https://hianime.to/watch/${encodedID}?ep=${episode.episodeId}`,
            number: episode.number
        }));
        
        return JSON.stringify(transformedResults);
    } catch (error) {
        console.log('extractEpisodes error:', error);
        return JSON.stringify([]);
    }    
}

async function extractStreamUrl(url) {
    try {
        const urlObj = new URL(url);
        const animeEpisodeId = urlObj.searchParams.get('ep');
        if (!animeEpisodeId) throw new Error('No episode ID in URL');

        // Changed to sub
        const response = await fetch(`https://api.animemundo.net/api/v2/hianime/episode/sources?animeEpisodeId=${animeEpisodeId}&category=sub`);
        const data = JSON.parse(response);
        
        const sources = data.data?.sources || [];
        const hlsSource = sources.find(source => source.type === 'hls');
        
        return hlsSource ? hlsSource.url : null;
    } catch (error) {
        console.log('extractStreamUrl error:', error);
        return null;
    }
}
