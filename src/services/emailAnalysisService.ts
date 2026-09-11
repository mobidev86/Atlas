import { supabase } from './supabase';
import { EmailActionableStore } from './emailActionableStore';
import { EmailMessage } from '../types';

interface FetchedEmail {
  id: string;
  threadId: string;
  subject: string;
  from: {
    name: string;
    email: string;
  };
  snippet: string;
  receivedAt: string;
  unread: boolean;
}

interface ActionableEmail {
  emailId: string;
  actionPoint: string;
  reason: string;
}

export const EmailAnalysisService = {
  async analyseEmails(): Promise<EmailMessage[]> {
    try {
      console.log('========================================');
      console.log('GLOBAL EMAIL ANALYSIS STARTED');
      console.log('========================================');

      // STEP 1 fetch
      console.log('FETCHING EMAILS FROM NYLAS...');

      const { data: fetchData, error: fetchError } =
        await supabase.functions.invoke('nylas-fetch-emails', {
          method: 'POST',
          body: {},
        });

      console.log('FETCH DATA:', JSON.stringify(fetchData, null, 2));

      if (fetchError) {
        console.error('FETCH ERROR:', fetchError);

        if (fetchError.context) {
          try {
            const errorBody = await fetchError.context.json();

            console.error(
              'FETCH ERROR BODY:',
              JSON.stringify(errorBody, null, 2),
            );
          } catch (error) {
            console.error('COULD NOT PARSE FETCH ERROR:', error);
          }
        }

        return [];
      }

      if (!fetchData?.success || !Array.isArray(fetchData.emails)) {
        console.error('INVALID FETCH RESPONSE:', fetchData);

        return [];
      }

      const fetchedEmails: FetchedEmail[] = fetchData.emails;

      console.log(`FETCHED ${fetchedEmails.length} EMAILS`);

      // STEP 2 triage
      console.log('STARTING EMAIL TRIAGE...');

      const { data: triageData, error: triageError } =
        await supabase.functions.invoke('nylas-triage-emails', {
          method: 'POST',
          body: {
            emails: fetchedEmails,
          },
        });

      console.log('TRIAGE DATA:', JSON.stringify(triageData, null, 2));

      if (triageError) {
        console.error('TRIAGE ERROR:', triageError);

        if (triageError.context) {
          try {
            const errorBody = await triageError.context.json();

            console.error(
              'TRIAGE ERROR BODY:',
              JSON.stringify(errorBody, null, 2),
            );
          } catch (error) {
            console.error('COULD NOT PARSE TRIAGE ERROR:', error);
          }
        }

        return [];
      }

      if (!triageData?.success || !Array.isArray(triageData.actionableEmails)) {
        console.error('INVALID TRIAGE RESPONSE:', triageData);

        return [];
      }

      const actionableEmails: ActionableEmail[] = triageData.actionableEmails;

      console.log(`FOUND ${actionableEmails.length} ACTIONABLE EMAILS`);

      // STEP 3 map
      const actionableEmailMessages: EmailMessage[] = actionableEmails
        .map(actionable => {
          const originalEmail = fetchedEmails.find(
            email => email.id === actionable.emailId,
          );

          if (!originalEmail) {
            return null;
          }

          return {
            id: originalEmail.id,
            senderName:
              originalEmail.from?.name ||
              originalEmail.from?.email ||
              'Unknown sender',
            senderEmail: originalEmail.from?.email || '',
            subject: originalEmail.subject || '(No subject)',
            summary: actionable.actionPoint || originalEmail.snippet || '',
            priority: 'high',
          } as EmailMessage;
        })
        .filter((email): email is EmailMessage => email !== null);

      // STEP 4 global store
      EmailActionableStore.setEmails(actionableEmailMessages);

      console.log(
        'ACTIONABLE EMAILS STORED:',
        JSON.stringify(actionableEmailMessages, null, 2),
      );

      console.log('========================================');
      console.log('GLOBAL EMAIL ANALYSIS COMPLETE');
      console.log('========================================');

      return actionableEmailMessages;
    } catch (error) {
      console.error('GLOBAL EMAIL ANALYSIS EXCEPTION:', error);

      return [];
    }
  },
};
