import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateExpirationDate, parseDurationToDays } from '@/lib/subscription-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscriptionId, newExpirationDate, newDuration } = body;

    console.log('Renewal request received:', {
      subscriptionId,
      newDuration,
      newExpirationDate,
      bodyKeys: Object.keys(body),
    });

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'Subscription ID is required' },
        { status: 400 }
      );
    }

    // Get the subscription to renew - ALWAYS update the same row, never create a new one
    const { data: originalSubscription, error: fetchError } = await supabaseAdmin
      .from('active_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .single();

    if (fetchError || !originalSubscription) {
      console.error('Subscription not found:', { subscriptionId, fetchError });
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    console.log('Found subscription to renew:', {
      id: originalSubscription.id,
      customer: originalSubscription.customer_name,
      currentExpiration: originalSubscription.expiration_date,
      currentDuration: originalSubscription.subscription_duration,
      renewalCount: originalSubscription.renewal_count,
    });

    // Determine new duration (use provided one or keep the same)
    // IMPORTANT: newDuration takes precedence over original duration
    const renewalDuration = newDuration ? newDuration : originalSubscription.subscription_duration;
    
    console.log('Duration determination:', {
      newDurationFromRequest: newDuration,
      originalDuration: originalSubscription.subscription_duration,
      finalRenewalDuration: renewalDuration,
    });

    // Calculate new dates - renewal extends from CURRENT EXPIRATION DATE
    // IMPORTANT: Start date is set to the CURRENT EXPIRATION DATE (not today)
    // This ensures the renewal period begins from where the subscription would have expired
    const now = new Date();
    const currentExpirationDate = new Date(originalSubscription.expiration_date);
    
    // Start date should be the current expiration date (where the subscription ends)
    // Example: If expiration is 11/19/2025, start_date becomes 11/19/2025
    const newStartDate = new Date(currentExpirationDate);
    console.log('Renewal calculation setup:', {
      today: now.toISOString(),
      currentExpiration: currentExpirationDate.toISOString(),
      currentExpirationDateOnly: currentExpirationDate.toDateString(),
      newStartDate: newStartDate.toISOString(),
      newStartDateOnly: newStartDate.toDateString(),
      oldStartDate: originalSubscription.start_date,
      oldExpiration: originalSubscription.expiration_date,
    });
    
    let newExpiration: Date;
    
    if (newExpirationDate) {
      newExpiration = new Date(newExpirationDate);
      console.log('Using provided expiration date:', newExpiration.toISOString());
    } else {
      // Calculate from duration - extend from CURRENT EXPIRATION DATE
      // Example: If expiration is in 30 days and renew for 1 month (30 days),
      // new expiration = current expiration + 30 days = 60 days from today
      const daysToAdd = parseDurationToDays(renewalDuration);
      console.log('Parsing duration:', {
        durationText: renewalDuration,
        daysToAdd,
      });
      
      // CRITICAL: Calculate expiration from CURRENT EXPIRATION DATE, not from today
      // This ensures the subscription period extends properly
      const expirationTime = currentExpirationDate.getTime();
      const daysInMs = daysToAdd * 24 * 60 * 60 * 1000;
      newExpiration = new Date(expirationTime + daysInMs);
      
      console.log('Expiration calculation (extending from current expiration):', {
        currentExpirationTime: expirationTime,
        currentExpirationDateOnly: currentExpirationDate.toDateString(),
        daysToAdd,
        daysInMs,
        newExpirationTime: newExpiration.getTime(),
        calculatedExpiration: newExpiration.toISOString(),
        calculatedExpirationDateOnly: newExpiration.toDateString(),
        oldExpiration: originalSubscription.expiration_date,
        oldExpirationDateOnly: new Date(originalSubscription.expiration_date).toDateString(),
        daysFromOldExpiration: Math.round((newExpiration.getTime() - currentExpirationDate.getTime()) / (1000 * 60 * 60 * 24)),
        daysFromToday: Math.round((newExpiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        willExpirationChange: newExpiration.toDateString() !== new Date(originalSubscription.expiration_date).toDateString(),
      });
      
      // Verify calculation using helper function
      const helperCalculation = calculateExpirationDate(newStartDate, renewalDuration);
      
      console.log('Date calculation verification:', {
        today: now.toISOString(),
        todayLocal: now.toLocaleString(),
        todayDateOnly: now.toDateString(),
        startDate: newStartDate.toISOString(),
        startDateLocal: newStartDate.toLocaleString(),
        startDateOnly: newStartDate.toDateString(),
        startDateIsCurrentExpiration: newStartDate.toDateString() === currentExpirationDate.toDateString(),
        daysToAdd,
        calculatedExpiration: newExpiration.toISOString(),
        calculatedExpirationLocal: newExpiration.toLocaleString(),
        calculatedExpirationDateOnly: newExpiration.toDateString(),
        helperCalculation: helperCalculation.toISOString(),
        helperCalculationDateOnly: helperCalculation.toDateString(),
        datesMatch: Math.abs(newExpiration.getTime() - helperCalculation.getTime()) < 1000,
        differenceMs: Math.abs(newExpiration.getTime() - helperCalculation.getTime()),
        daysDifference: Math.round((newExpiration.getTime() - newStartDate.getTime()) / (1000 * 60 * 60 * 24)),
        expectedDays: daysToAdd,
      });
    }

    // Verify the calculation is correct
    const oldExpDate = new Date(originalSubscription.expiration_date);
    const newExpDate = newExpiration;
    const today = new Date();
    
    console.log('Renewal details - BEFORE update:', {
      subscriptionId,
      renewalDuration,
      today: today.toISOString(),
      oldStartDate: originalSubscription.start_date,
      newStartDate: newStartDate.toISOString(),
      oldExpiration: originalSubscription.expiration_date,
      newExpiration: newExpiration.toISOString(),
      daysToAdd: parseDurationToDays(renewalDuration),
      startDateWillChange: originalSubscription.start_date !== newStartDate.toISOString(),
      expirationWillChange: originalSubscription.expiration_date !== newExpiration.toISOString(),
      oldExpirationDate: oldExpDate.toDateString(),
      newExpirationDate: newExpDate.toDateString(),
      daysFromToday: Math.round((newExpDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
      shouldBeDaysFromToday: parseDurationToDays(renewalDuration),
    });

    // STEP 1: Copy the current subscription to renewed_subscriptions table
    // This preserves the subscription state before renewal
    console.log('Copying subscription to renewed_subscriptions table:', subscriptionId);
    
    // Provide fallback values for required fields that might be null
    // renewed_subscriptions requires customer_name and customer_email to be NOT NULL
    const customerName = originalSubscription.customer_name || 
                        originalSubscription.subscription_code || 
                        'Unknown Customer';
    const customerEmail = originalSubscription.customer_email || 
                         `subscription-${originalSubscription.subscription_code}@unknown.local`;
    
    console.log('Customer data for renewal snapshot:', {
      originalCustomerName: originalSubscription.customer_name,
      originalCustomerEmail: originalSubscription.customer_email,
      fallbackCustomerName: customerName,
      fallbackCustomerEmail: customerEmail,
    });
    
    const { data: renewedSnapshot, error: copyError } = await supabaseAdmin
      .from('renewed_subscriptions')
      .insert({
        original_subscription_id: subscriptionId,
        order_id: originalSubscription.order_id,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: originalSubscription.customer_phone,
        subscription_code: originalSubscription.subscription_code,
        subscription_type: originalSubscription.subscription_type,
        subscription_duration: originalSubscription.subscription_duration,
        expiration_date: originalSubscription.expiration_date, // Old expiration date
        start_date: originalSubscription.start_date, // Old start date
        product_code: originalSubscription.product_code,
        reminder_sent: originalSubscription.reminder_sent,
        reminder_sent_at: originalSubscription.reminder_sent_at,
        last_contacted_at: originalSubscription.last_contacted_at,
        renewed_from_subscription_id: originalSubscription.renewed_from_subscription_id,
        is_renewed: originalSubscription.is_renewed,
        renewal_count: originalSubscription.renewal_count || 0,
        created_at: originalSubscription.created_at,
        updated_at: originalSubscription.updated_at,
        renewed_at: new Date().toISOString(), // When this renewal snapshot was created
      })
      .select()
      .single();

    if (copyError) {
      console.error('Error copying subscription to renewed_subscriptions:', copyError);
      return NextResponse.json(
        { error: 'Failed to create renewal snapshot', details: copyError.message },
        { status: 500 }
      );
    }

    console.log('✓ Successfully copied subscription to renewed_subscriptions:', {
      snapshotId: renewedSnapshot.id,
      originalSubscriptionId: subscriptionId,
      oldExpiration: originalSubscription.expiration_date,
    });

    // STEP 2: Update the EXISTING subscription row in active_subscriptions
    // This updates the subscription with new expiration date and start date
    console.log('Updating existing subscription row in active_subscriptions:', subscriptionId);
    
    // CRITICAL: Start date is set to CURRENT EXPIRATION DATE (not today)
    // Expiration date extends from the CURRENT expiration date by the selected duration
    // Example: If expiration is 11/19/2025 and renewing for 3 months:
    //   - start_date becomes: 11/19/2025 (current expiration)
    //   - expiration_date becomes: 02/19/2026 (11/19/2025 + 3 months)
    const updateData: any = {
      start_date: newStartDate.toISOString(), // Set to current expiration date
      expiration_date: newExpiration.toISOString(), // Extends from current expiration + duration
      subscription_duration: renewalDuration,
      renewal_count: (originalSubscription.renewal_count || 0) + 1,
      is_renewed: true, // Mark as renewed
      reminder_sent: false, // Reset reminder flag for new period
      reminder_sent_at: null,
      // Don't set renewed_from_subscription_id - it references active_subscriptions, not renewed_subscriptions
      // We can track the renewal via the renewed_subscriptions table using original_subscription_id
      renewed_from_subscription_id: null,
    };
    
    // Verify the dates are correct before updating
    const oldStartTimestamp = new Date(originalSubscription.start_date).getTime();
    const newStartTimestamp = newStartDate.getTime();
    const startDateWillChange = oldStartTimestamp !== newStartTimestamp;
    
    console.log('Update payload verification:', {
      startDate: updateData.start_date,
      expirationDate: updateData.expiration_date,
      duration: updateData.subscription_duration,
      oldStartDate: originalSubscription.start_date,
      newStartDate: updateData.start_date,
      oldStartTimestamp,
      newStartTimestamp,
      startDateWillChange,
      startDateIsToday: new Date(updateData.start_date).toDateString() === new Date().toDateString(),
      expirationIsFuture: new Date(updateData.expiration_date) > new Date(updateData.start_date),
    });

    // Note: updated_at is handled by the database trigger
    console.log('Update data to be sent:', JSON.stringify(updateData, null, 2));
    console.log('Update will target subscription ID:', subscriptionId);
    console.log('Start date (current expiration):', updateData.start_date);
    console.log('New expiration date:', updateData.expiration_date);

    // Perform the update and return the updated row
    const { data: renewedSubscription, error: updateError } = await supabaseAdmin
      .from('active_subscriptions')
      .update(updateData)
      .eq('id', subscriptionId) // CRITICAL: Update by ID to ensure we update the same row
      .select()
      .single();

    console.log('Update query result:', {
      hasData: !!renewedSubscription,
      hasError: !!updateError,
      error: updateError,
      updatedId: renewedSubscription?.id,
      errorCode: (updateError as any)?.code,
      errorMessage: (updateError as any)?.message,
      errorDetails: (updateError as any)?.details,
    });

    if (updateError) {
      console.error('Error renewing subscription:', updateError);
      console.error('Update error details:', JSON.stringify(updateError, null, 2));
      
      // Check if it's an RLS policy issue
      if ((updateError as any)?.message?.includes('permission') || 
          (updateError as any)?.message?.includes('denied') ||
          (updateError as any)?.code === '42501') {
        return NextResponse.json(
          { error: 'Permission denied. Check RLS policies for active_subscriptions table.', details: updateError.message },
          { status: 403 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to renew subscription', details: updateError.message, code: (updateError as any)?.code },
        { status: 500 }
      );
    }

    // Verify the update was successful
    if (!renewedSubscription) {
      console.error('ERROR: Update returned no data! This might indicate:');
      console.error('1. RLS policy blocking the SELECT');
      console.error('2. The row was not found (ID mismatch)');
      console.error('3. Database constraint violation');
      return NextResponse.json(
        { error: 'Failed to update subscription - no data returned. Check database logs.' },
        { status: 500 }
      );
    }

    console.log('✓ Successfully updated existing subscription row - AFTER update:', {
      id: renewedSubscription.id,
      subscriptionId: subscriptionId,
      sameId: renewedSubscription.id === subscriptionId,
      customer: renewedSubscription.customer_name,
      oldStartDate: originalSubscription.start_date,
      newStartDate: renewedSubscription.start_date,
      expectedStartDate: newStartDate.toISOString(),
      oldExpiration: originalSubscription.expiration_date,
      newExpiration: renewedSubscription.expiration_date,
      expectedExpiration: newExpiration.toISOString(),
      oldDuration: originalSubscription.subscription_duration,
      newDuration: renewedSubscription.subscription_duration,
      oldRenewalCount: originalSubscription.renewal_count,
      newRenewalCount: renewedSubscription.renewal_count,
      startDateChanged: renewedSubscription.start_date !== originalSubscription.start_date,
      expirationChanged: renewedSubscription.expiration_date !== originalSubscription.expiration_date,
      startDateMatches: renewedSubscription.start_date === newStartDate.toISOString() || 
                        Math.abs(new Date(renewedSubscription.start_date).getTime() - newStartDate.getTime()) < 1000,
      expirationMatches: renewedSubscription.expiration_date === newExpiration.toISOString() ||
                         Math.abs(new Date(renewedSubscription.expiration_date).getTime() - newExpiration.getTime()) < 1000,
      startDateWasUpdated: new Date(renewedSubscription.start_date).getTime() !== new Date(originalSubscription.start_date).getTime(),
    });

    // Compare dates by both date and timestamp to verify the update
    const oldExpDateOnly = new Date(originalSubscription.expiration_date).toDateString();
    const newExpDateOnly = new Date(renewedSubscription.expiration_date).toDateString();
    const expectedExpDateOnly = newExpiration.toDateString();
    const oldStartDateOnly = new Date(originalSubscription.start_date).toDateString();
    const newStartDateOnly = new Date(renewedSubscription.start_date).toDateString();
    
    // Get the expected timestamp (current expiration date)
    const expectedStartTimestamp = newStartDate.getTime();
    const expectedStartDateOnly = newStartDate.toDateString();
    
    // Verify start_date timestamp was actually updated
    const actualStartTimestamp = new Date(renewedSubscription.start_date).getTime();
    const oldStartTimestampValue = new Date(originalSubscription.start_date).getTime();
    const startTimestampChanged = Math.abs(actualStartTimestamp - expectedStartTimestamp) < 1000; // Within 1 second
    const startTimestampActuallyChanged = actualStartTimestamp !== oldStartTimestampValue;
    
    // Verify the update was successful (compare dates, not strings, since format may differ)
    if (renewedSubscription && renewedSubscription.expiration_date) {
      const expectedDate = new Date(newExpiration.toISOString()).getTime();
      const actualDate = new Date(renewedSubscription.expiration_date).getTime();
      const expectedDateOnly = new Date(newExpiration.toISOString()).toDateString();
      const actualDateOnly = new Date(renewedSubscription.expiration_date).toDateString();
      
      if (Math.abs(expectedDate - actualDate) > 1000) { // More than 1 second difference
        console.warn('Warning: Expiration date mismatch!', {
          expected: newExpiration.toISOString(),
          expectedDateOnly,
          actual: renewedSubscription.expiration_date,
          actualDateOnly,
          expectedTime: expectedDate,
          actualTime: actualDate,
        });
      } else {
        console.log('✓ Expiration date updated correctly');
      }
      
      // Verify start_date was updated
      if (!startTimestampChanged) {
        console.warn('Warning: Start date timestamp may not have updated correctly!', {
          expectedStartTimestamp,
          actualStartTimestamp,
          differenceMs: Math.abs(actualStartTimestamp - expectedStartTimestamp),
          oldStartDate: originalSubscription.start_date,
          newStartDate: renewedSubscription.start_date,
          expectedStartDate: newStartDate.toISOString(),
        });
      } else {
        console.log('✓ Start date updated correctly');
      }
      
      console.log('Date comparison:', {
        oldExpirationDateOnly: oldExpDateOnly,
        newExpirationDateOnly: newExpDateOnly,
        expectedExpirationDateOnly: expectedExpDateOnly,
        expirationDateActuallyChanged: newExpDateOnly !== oldExpDateOnly,
        oldStartDateOnly,
        newStartDateOnly,
        expectedStartDateOnly,
        startDateActuallyChanged: newStartDateOnly !== oldStartDateOnly,
        startTimestampChanged,
        startTimestampActuallyChanged,
        oldStartTimestamp: oldStartTimestampValue,
        newStartTimestamp: actualStartTimestamp,
        expectedStartTimestamp: expectedStartTimestamp,
        startDateWasUpdated: startTimestampActuallyChanged,
        startDateIsCurrentExpiration: newStartDateOnly === new Date(originalSubscription.expiration_date).toDateString(),
      });
    }

    // Final verification: ensure we updated the same row, not created a new one
    if (renewedSubscription.id !== subscriptionId) {
      console.error('CRITICAL ERROR: Updated row has different ID!', {
        expectedId: subscriptionId,
        actualId: renewedSubscription.id,
      });
      return NextResponse.json(
        { error: 'Internal error: Row ID mismatch' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      subscription: renewedSubscription,
      renewalSnapshot: renewedSnapshot,
      renewalDetails: {
        newStartDate: newStartDate.toISOString(),
        newExpirationDate: newExpiration.toISOString(),
        newDuration: renewalDuration,
        oldExpirationDate: originalSubscription.expiration_date,
        oldStartDate: originalSubscription.start_date,
      },
      message: 'Subscription renewed - snapshot created in renewed_subscriptions, active_subscriptions updated',
    });
  } catch (error: any) {
    console.error('Error in renew subscription:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

