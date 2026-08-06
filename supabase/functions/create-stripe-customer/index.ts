import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from '@supabase/server';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
});

export default {
  fetch: withSupabase(
    {
      auth: ['publishable'],
    },
    async (req, ctx) => {
      try {
        // Get authenticated user
        const {
          data: { user },
          error: userError,
        } = await ctx.supabase.auth.getUser();

        if (userError || !user) {
          return Response.json(
            {
              error: 'User not authenticated',
            },
            {
              status: 401,
            },
          );
        }

        // Get profile
        const { data: profile, error: profileError } = await ctx.supabase
          .from('profiles')
          .select('email, full_name, stripe_customer_id')
          .eq('id', user.id)
          .single();

        if (profileError) {
          throw profileError;
        }

        // Customer already exists
        if (profile.stripe_customer_id) {
          return Response.json({
            customerId: profile.stripe_customer_id,
          });
        }

        // Create Stripe Customer
        const customer = await stripe.customers.create({
          email: profile.email,
          name: profile.full_name ?? undefined,
          metadata: {
            supabase_user_id: user.id,
          },
        });

        // Update profile
        const { error: updateError } = await ctx.supabase
          .from('profiles')
          .update({
            stripe_customer_id: customer.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);

        if (updateError) {
          throw updateError;
        }

        return Response.json({
          customerId: customer.id,
        });
      } catch (error) {
        console.error(error);
        return Response.json(
          {
            error: error.message,
          },
          {
            status: 500,
          },
        );
      }
    },
  ),
};
