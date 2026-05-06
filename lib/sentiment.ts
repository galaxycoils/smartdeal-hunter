export async function getSentimentSummary(text: string): Promise<string> {
  // Mock sentiment summary
  return `Sentiment Analysis: ${text.length > 50 ? 'Positive' : 'Neutral'}. Summary: ${text.substring(0, 50)}...`;
}
