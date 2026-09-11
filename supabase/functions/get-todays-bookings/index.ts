import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  try {
    // ---------------------------------------------------------
    // Environment variables
    // ---------------------------------------------------------
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Supabase environment variables are not configured.',
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      );
    }

    // ---------------------------------------------------------
    // Create Supabase client using the user's JWT
    // ---------------------------------------------------------
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Authorization header is required.',
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // ---------------------------------------------------------
    // Get currently authenticated user
    // ---------------------------------------------------------
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unauthorized. Please sign in again.',
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      );
    }

    // ---------------------------------------------------------
    // Current date
    //
    // Uses UTC date here.
    // If you want India/local timezone specifically, see note below.
    // ---------------------------------------------------------
    const today = new Date().toISOString().split('T')[0];

    // ---------------------------------------------------------
    // Get today's bookings for current user
    //
    // departure_date is used for:
    //   - Flights -> departure date
    //   - Hotels -> check-in date
    // ---------------------------------------------------------
    const { data: bookings, error: bookingsError } = await supabase
      .from('user_bookings')
      .select(
        `
        id,
        user_id,
        booking_type,
        source,
        destination,
        booking_id,
        status,
        booking_reference,
        "fullName",
        created_at,
        updated_at,
        departure_date,
        return_date,
        hotel_name,
        airline,
        passenger_name,
        price,
        currency
      `,
      )
      .eq('user_id', user.id)
      .eq('departure_date', today)
      .order('departure_date', {
        ascending: true,
      })
      .order('created_at', {
        ascending: false,
      });

    if (bookingsError) {
      console.error('Failed to fetch bookings:', bookingsError);

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to fetch bookings.',
          details: bookingsError.message,
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      );
    }

    // ---------------------------------------------------------
    // Normalize response
    // ---------------------------------------------------------
    const normalizedBookings = (bookings || []).map(booking => ({
      id: booking.id,
      bookingType: booking.booking_type,

      source: booking.source,
      destination: booking.destination,

      bookingId: booking.booking_id,
      bookingReference: booking.booking_reference,

      status: booking.status,

      fullName: booking.fullName,
      passengerName: booking.passenger_name,

      departureDate: booking.departure_date,
      returnDate: booking.return_date,

      hotelName: booking.hotel_name,
      airline: booking.airline,

      price: booking.price,
      currency: booking.currency,

      createdAt: booking.created_at,
      updatedAt: booking.updated_at,
    }));

    // ---------------------------------------------------------
    // Response
    // ---------------------------------------------------------
    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        count: normalizedBookings.length,
        bookings: normalizedBookings,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    console.error('Unexpected error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Unexpected server error.',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  }
});
