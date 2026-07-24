import { ENV, isConfigured } from '../config/env';
import { apiRequest } from './apiClient';
import { TravelIntent } from '../types';

export class AIService {
  /**
   * Parse natural language travel prompt into structured travel intent parameters
   */
  static async parseTravelIntent(prompt: string): Promise<TravelIntent> {
    if (!isConfigured('OPENAI_API_KEY')) {
      // Fallback intent parsing logic
      const promptLower = prompt.toLowerCase();
      let destination = 'New York, USA';
      if (promptLower.includes('tokyo') || promptLower.includes('japan')) destination = 'Tokyo, Japan';
      if (promptLower.includes('london') || promptLower.includes('uk')) destination = 'London, UK';
      if (promptLower.includes('paris') || promptLower.includes('france')) destination = 'Paris, France';
      if (promptLower.includes('singapore')) destination = 'Singapore';

      return {
        destination,
        origin: 'San Francisco, USA',
        departureDate: '2026-08-04',
        returnDate: '2026-08-08',
        cabinPreference: promptLower.includes('business') ? 'business' : 'first',
        hotelStars: 5,
        amenities: ['Spa', 'Fitness Center', 'Executive Lounge', 'High-Speed Wi-Fi'],
      };
    }

    try {
      const response = await apiRequest<any>('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ENV.OPENAI_API_KEY}`,
        },
        isZeroRetention: true,
        body: JSON.stringify({
          model: ENV.OPENAI_MODEL,
          store: false, // ZERO-RETENTION ENFORCEMENT
          messages: [
            {
              role: 'system',
              content:
                'Extract travel criteria from user prompt into JSON: { destination, origin, departureDate, returnDate, cabinPreference, hotelStars, amenities }',
            },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
        }),
      });

      if (response.data && response.data.choices && response.data.choices[0]) {
        const parsed = JSON.parse(response.data.choices[0].message.content);
        return parsed as TravelIntent;
      }
    } catch (e) {
      console.warn('OpenAI Travel Intent Error, falling back to mock:', e);
    }

    return {
      destination: 'New York (JFK)',
      origin: 'San Francisco (SFO)',
      departureDate: 'Aug 4, 2026',
      returnDate: 'Aug 8, 2026',
      cabinPreference: 'business',
      hotelStars: 5,
      amenities: ['Executive lounge', 'Late check-out'],
    };
  }

  /**
   * Distill email body into executive action-point summary and priority ranking
   */
  static async summarizeEmail(
    subject: string,
    body: string
  ): Promise<{ summary: string; priority: 'high' | 'medium' | 'low'; actionItem?: string }> {
    if (!isConfigured('OPENAI_API_KEY')) {
      const isHighPriority = subject.toLowerCase().includes('urgent') || subject.toLowerCase().includes('q3') || subject.toLowerCase().includes('budget');
      return {
        summary: `Needs feedback on ${subject}. Requires executive sign-off before EOD.`,
        priority: isHighPriority ? 'high' : 'medium',
        actionItem: `Reply to ${subject} with approval decision`,
      };
    }

    try {
      const response = await apiRequest<any>('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ENV.OPENAI_API_KEY}`,
        },
        isZeroRetention: true,
        body: JSON.stringify({
          model: ENV.OPENAI_MODEL,
          store: false, // ZERO-RETENTION ENFORCEMENT
          messages: [
            {
              role: 'system',
              content:
                'Summarize email thread in 1 concise sentence. Output JSON: { summary, priority: "high"|"medium"|"low", actionItem }',
            },
            { role: 'user', content: `Subject: ${subject}\n\nBody: ${body}` },
          ],
          response_format: { type: 'json_object' },
        }),
      });

      if (response.data?.choices?.[0]?.message?.content) {
        return JSON.parse(response.data.choices[0].message.content);
      }
    } catch (e) {
      console.warn('OpenAI Email Summarizer Error:', e);
    }

    return {
      summary: 'Action item requested regarding Q3 schedule update.',
      priority: 'high',
      actionItem: 'Confirm availability for Q3 strategy call',
    };
  }

  /**
   * Convert user spoken voice dictation into a polished executive email reply draft
   */
  static async generatePolishedReply(
    emailSubject: string,
    emailContext: string,
    userDictation: string
  ): Promise<string> {
    if (!isConfigured('OPENAI_API_KEY')) {
      return `Hi Sarah,\n\nThanks for reaching out regarding ${emailSubject}.\n\nBased on your note: "${userDictation}", I have reviewed the details and approve moving forward with the proposed timeline for next week. Let's touch base on Tuesday if any adjustments are needed.\n\nBest regards,\nOmar`;
    }

    try {
      const response = await apiRequest<any>('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ENV.OPENAI_API_KEY}`,
        },
        isZeroRetention: true,
        body: JSON.stringify({
          model: ENV.OPENAI_MODEL,
          store: false, // ZERO-RETENTION ENFORCEMENT
          messages: [
            {
              role: 'system',
              content:
                'You are an executive AI drafting assistant. Transform the user spoken dictation into a professional, clear, warm, and concise executive email reply matching the context of the original email thread.',
            },
            {
              role: 'user',
              content: `Original Email Context: ${emailContext}\nSubject: ${emailSubject}\n\nUser Voice Dictation: "${userDictation}"\n\nGenerate polished email response draft:`,
            },
          ],
        }),
      });

      if (response.data?.choices?.[0]?.message?.content) {
        return response.data.choices[0].message.content.trim();
      }
    } catch (e) {
      console.warn('OpenAI Draft Generator Error:', e);
    }

    return `Hi Sarah,\n\nI reviewed the details you sent regarding ${emailSubject}. Everything looks aligned with our objectives.\n\nBest,\nOmar`;
  }
}
