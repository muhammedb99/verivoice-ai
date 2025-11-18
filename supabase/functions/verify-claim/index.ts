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
async function searchWikipedia(query: string, language = 'en', limit = 5): Promise<WikiSearchResult[]> {
  const url = new URL(`https://${language}.wikipedia.org/w/api.php`);
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
async function getWikipediaContent(pageId: number, language = 'en'): Promise<string> {
  const url = new URL(`https://${language}.wikipedia.org/w/api.php`);
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

    const { claim, language = 'en' } = await req.json();
    if (!claim) {
      throw new Error('No claim provided');
    }

    console.log('Verifying claim:', claim, 'Language:', language);

    // Step 1: Search Wikipedia for relevant articles
    const searchResults = await searchWikipedia(claim, language, 3);
    console.log(`Found ${searchResults.length} Wikipedia articles`);

    // Step 2: Retrieve content from top results
    const evidencePromises = searchResults.slice(0, 3).map(async (result) => {
      const content = await getWikipediaContent(result.pageid, language);
      return {
        title: result.title,
        snippet: result.snippet.replace(/<[^>]*>/g, ''), // Remove HTML tags
        content: content.substring(0, 1000), // Limit content length
        url: `https://${language}.wikipedia.org/?curid=${result.pageid}`,
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

    // Create language-specific prompts
    const systemPrompts: Record<string, string> = {
      en: `You are a careful fact-checking assistant. Analyze the claim and evidence provided to determine if the claim is:
- "Supported": The evidence clearly supports the claim
- "Refuted": The evidence contradicts the claim
- "Not Enough Info": The evidence is insufficient to verify the claim

Be objective, cite specific evidence, and express appropriate uncertainty when warranted. Never invent facts. Respond in English.`,
      ar: `أنت مساعد دقيق في التحقق من الحقائق. قم بتحليل الادعاء والأدلة المقدمة لتحديد ما إذا كان الادعاء:
- "Supported": الأدلة تدعم الادعاء بوضوح
- "Refuted": الأدلة تتناقض مع الادعاء
- "Not Enough Info": الأدلة غير كافية للتحقق من الادعاء

كن موضوعياً، واستشهد بأدلة محددة، وعبر عن عدم اليقين المناسب عند الحاجة. لا تختلق الحقائق أبداً. الرد يجب أن يكون باللغة العربية.`,
      he: `אתה עוזר זהיר לבדיקת עובדות. נתח את הטענה והראיות שסופקו כדי לקבוע אם הטענה:
- "Supported": הראיות תומכות בבירור בטענה
- "Refuted": הראיות סותרות את הטענה
- "Not Enough Info": הראיות אינן מספיקות כדי לאמת את הטענה

היה אובייקטיבי, צטט ראיות ספציפיות והבע אי-ודאות מתאימה כאשר יש מקום לכך. לעולם אל תמציא עובדות. השב בעברית.`
    };

    const userMessages: Record<string, string> = {
      en: `Claim: "${claim}"

Evidence:
${evidence.map((e, i) => `[${i}] ${e.title}
${e.content}
URL: ${e.url}`).join('\n\n')}

Verify this claim and respond using the verify_claim_with_evidence function.`,
      ar: `الادعاء: "${claim}"

الأدلة:
${evidence.map((e, i) => `[${i}] ${e.title}
${e.content}
الرابط: ${e.url}`).join('\n\n')}

تحقق من هذا الادعاء واستجب باستخدام وظيفة verify_claim_with_evidence.`,
      he: `טענה: "${claim}"

ראיות:
${evidence.map((e, i) => `[${i}] ${e.title}
${e.content}
קישור: ${e.url}`).join('\n\n')}

אמת טענה זו והשב באמצעות פונקציית verify_claim_with_evidence.`
    };

    const systemPrompt = systemPrompts[language] || systemPrompts.en;
    const userMessage = userMessages[language] || userMessages.en;

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

    let verification = JSON.parse(toolCall.function.arguments);

    // If non-English language selected, translate the explanation
    if (language !== 'en' && verification?.explanation) {
      try {
        const translationSystemPrompts: Record<string, string> = {
          ar: 'أنت مساعد ترجمة. ترجم النص التالي إلى العربية بلغة طبيعية ومختصرة بدون أي شروحات إضافية أو نصوص أخرى. أعد النص المترجم فقط.',
          he: 'אתה עוזר תרגום. תרגם את הטקסט הבא לעברית בשפה טבעית ותמציתית ללא שום הסברים נוספים או טקסט נוסף. החזר רק את הטקסט המתורגם.'
        };

        const translationPrompt = translationSystemPrompts[language];

        if (translationPrompt) {
          const translationResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash-lite',
              messages: [
                { role: 'system', content: translationPrompt },
                { role: 'user', content: verification.explanation },
              ],
            }),
          });

          if (translationResponse.ok) {
            const translationResult = await translationResponse.json();
            const translatedExplanation = translationResult.choices?.[0]?.message?.content;
            if (typeof translatedExplanation === 'string' && translatedExplanation.trim()) {
              verification.explanation = translatedExplanation.trim();
            }
          } else {
            console.error('Translation request failed with status', translationResponse.status);
          }
        }
      } catch (translationError) {
        console.error('Error translating explanation:', translationError);
      }
    }

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
