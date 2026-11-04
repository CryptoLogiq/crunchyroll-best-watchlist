/* Ordered audio preferences. Availability is evaluated per episode, not per title. */
BWL.audioLanguages = ['ja-JP','en-US','fr-FR','de-DE','es-419','es-ES','pt-BR','it-IT','ru-RU','hi-IN','ta-IN','te-IN','ko-KR','zh-CN','ar-SA'];
BWL.audioPreferences = (prefs, id) => {
  const override = prefs.series[id];
  return [...new Set([override?.primary || prefs.audioPrimary, override?.secondary || prefs.audioSecondary])];
};
BWL.selectAudioEpisodes = (episodes, languages, originalIds = [], now = Date.now()) => {
  const groups = new Map();
  const available = ep => (!ep.availability_status || ep.availability_status === 'available') &&
    (!Date.parse(ep.availability_starts || ep.premium_available_date || '') || Date.parse(ep.availability_starts || ep.premium_available_date) <= now);
  for (const ep of episodes.filter(ep => !ep.is_clip)) {
    const key = ep.sequence_number ?? ep.episode_number ?? ep.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(ep);
  }
  return [...groups.values()].map(versions => {
    const chosen = languages.map(lang => versions.find(ep => ep.audio_locale === lang && available(ep))).find(Boolean);
    const reference = chosen || versions.find(available) || versions[0];
    return { ...reference, preferenceUnavailable: !chosen,
      preferenceOriginal: originalIds.includes(reference.id) || reference.versions?.some(v => v.original && v.guid === reference.id),
      versions: [...new Map(versions.flatMap(ep => [{ guid: ep.id, audio_locale: ep.audio_locale }, ...(ep.versions || [])]).map(v => [v.guid, v])).values()] };
  });
};
