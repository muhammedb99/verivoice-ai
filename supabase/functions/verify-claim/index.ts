import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WikiSearchResult {
  title: string;
  snippet: string;
  pageid: number;
}

// Tool: Search Wikipedia
async function searchWikipedia(query: string, limit = 5): Promise<WikiSearchResult[]> {
  const url = new URL('https://en.wikipedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('list', 'search');
  url.searchParams.set('srsearch', query);
  url.searchParams.set('srlimit', limit.toString());
  url.searchParams.set('format', 'json');
  url.searchParams.set('srprop', 'snippet');

  const response = await fetch(url.toString());
  const data = await response.json();

  return data.query?.search || [];
}

// Tool: Get Wikipedia page content
async function getWikipediaContent(pageId: number): Promise<string> {
  const url = new URL('https://en.wikipedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('pageids', pageId.toString());
  url.searchParams.set('prop', 'extracts');
  url.searchParams.set('exintro', 'true');
  url.searchParams.set('explaintext', 'true');
  url.searchParams.set('format', 'json');

  const response = await fetch(url.toString());
  const data = await response.json();

  const page = data.query?.pages?.[pageId];
  return page?.extract || '';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const { claim } = await req.json();
    if (!claim) {
      throw new Error('No claim provided');
    }

    console.log('Verifying claim:', claim);

    // Step 1: Search Wikipedia for relevant articles
    const searchResults = await searchWikipedia(claim, 3);
    console.log(`Found ${searchResults.length} Wikipedia articles`);

    // Step 2: Retrieve content from top results
    const evidencePromises = searchResults.slice(0, 3).map(async (result) => {
      const content = await getWikipediaContent(result.pageid);
      return {
        title: result.title,
        snippet: result.snippet.replace(/<[^>]*>/g, ''), // Remove HTML tags
        content: content.substring(0, 1000), // Limit content length
        url: `https://en.wikipedia.org/?curid=${result.pageid}`,
      };
    });

    const evidence = await Promise.all(evidencePromises);

    // Step 3: Use Lovable AI to verify the claim with tool calling
    const tools = [
      {
        type: "function",
        function: {
          name: "verify_claim_with_evidence",
          description: "Verify a claim based on provided evidence and determine if it's Supported, Refuted, or if there's Not Enough Info",
          parameters: {
            type: "object",
            properties: {
              verdict: {
                type: "string",
                enum: ["Supported", "Refuted", "Not Enough Info"],
                description: "The verification verdict"
              },
              explanation: {
                type: "string",
                description: "A clear explanation of why the claim has this verdict, citing specific evidence"
              },
              confidence: {
                type: "number",
                description: "Confidence score between 0 and 1"
              },
              relevant_citations: {
                type: "array",
                items: { type: "number" },
                description: "Array of indices of the most relevant evidence items (0-based)"
              }
            },
            required: ["verdict", "explanation", "confidence", "relevant_citations"]
          }
        }
      }
    ];

    const systemPrompt = `You are a careful fact-checking assistant. Analyze the claim and evidence provided to determine if the claim is:
- "Supported": The evidence clearly supports the claim
- "Refuted": The evidence contradicts the claim
- "Not Enough Info": The evidence is insufficient to verify the claim

Be objective, cite specific evidence, and express appropriate uncertainty when warranted. Never invent facts.`;

    const userMessage = `Claim: "${claim}"

Evidence:
${evidence.map((e, i) => `[${i}] ${e.title}
${e.content}
URL: ${e.url}`).join('\n\n')}

Verify this claim and respond using the verify_claim_with_evidence function.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        tools,
        tool_choice: { type: "function", function: { name: "verify_claim_with_evidence" } },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Lovable AI error:', error);
      throw new Error(`AI verification failed: ${response.status}`);
    }

    const aiResult = await response.json();
    console.log('AI verification complete');

    // Parse the tool call response
    const toolCall = aiResult.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No tool call in AI response');
    }

    const verification = JSON.parse(toolCall.function.arguments);

    // Map citations to actual evidence
    const citations = verification.relevant_citations.map((index: number) => {
      const e = evidence[index];
      return {
        title: e.title,
        snippet: e.snippet,
        url: e.url,
        confidence: verification.confidence,
      };
    });

    return new Response(
      JSON.stringify({
        transcript: claim,
        verdict: verification.verdict,
        explanation: verification.explanation,
        confidence: verification.confidence,
        citations,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in verify-claim function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
