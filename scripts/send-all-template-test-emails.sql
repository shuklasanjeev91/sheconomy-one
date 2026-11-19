-- Queue one email-only test notification per active template for Sanjeev.
-- Then dispatch-notifications sends them via Resend + Mailchimp chrome.

DO $$
DECLARE
  r RECORD;
  v_user uuid := '589ae4f0-7b9c-4c51-8c3f-7be87fc057af';
  v_vars jsonb;
  v_id uuid;
  v_title text;
  v_message text;
  v_action text;
  v_ok integer := 0;
  v_fail integer := 0;
  v_err text;
BEGIN
      v_vars := jsonb_build_object(
    'action_url', 'https://www.sheconomy.in/cart',
    'ad_revenue', '12,450',
    'applies_to', 'All physical goods',
    'article_title', 'Building a women-led brand',
    'author_name', 'Asha Verma',
    'balance', '2,500.00 INR',
    'base_url', 'https://www.sheconomy.in',
    'buyer_name', 'Sanjeev Shukla',
    'call_label', 'Voice call',
    'caller_name', 'Priya Sharma',
    'campaign_name', 'Spring Spotlight',
    'cancellation_rate', '3.2%',
    'cancellation_reason', 'Changed mind',
    'carrier_name', 'Delhivery',
    'cart_total', '11,596.00 INR',
    'category_name', 'Home & Living',
    'celebration_title', 'First 100 orders!',
    'checkout_total', '1,299.00 INR',
    'comment_preview', 'This looks amazing — when will it ship?',
    'commenter_name', 'Neha Kapoor',
    'company_name', 'Bioayurveda',
    'connection_requests', '4',
    'coupon_code', 'SHETEST20',
    'course_title', 'Seller Growth Lab',
    'cross_sell_summary', 'Matching tote + candle set',
    'cta_hint', 'Complete checkout today',
    'currency', 'INR',
    'currency_note', 'Prices in INR',
    'current_stock', '4',
    'customer_currency', 'INR',
    'customer_discount_amount', '100.00',
    'customer_name', 'Sanjeev',
    'customer_payment_amount', '1,199.00',
    'customer_phone', '+91 98765 43210',
    'customer_refund_amount', '499.00',
    'customer_shipping_amount', '49.00',
    'customer_subtotal_amount', '1,150.00',
    'customer_tax_amount', '0.00',
    'customer_total_amount', '1,199.00',
    'device_info', 'Chrome on macOS'
  ) ||
           jsonb_build_object(
    'device_label', 'MacBook Pro',
    'discount_label', '20% off',
    'discount_name', 'Welcome offer',
    'discount_offer', 'Flat 20% off',
    'duration_minutes', '45',
    'end_date', '30 Nov 2026',
    'endorser_name', 'Ritu Jain',
    'estimated_delivery', '22 Nov 2026',
    'estimated_reach', '25,000',
    'event_name', 'Diwali Maker Fair',
    'event_title', 'Women Founders Meetup',
    'failure_reason', 'Card declined',
    'follower_name', 'Ananya Rao',
    'full_name', 'Sanjeev Shukla',
    'gmv', '1,24,000',
    'group_name', 'Delhi Makers',
    'guest_name', 'Kavita Mehta',
    'hashtag', 'SheEconomy',
    'host_name', 'Meera Joshi',
    'hours_remaining', '18',
    'inquiry_message', 'Do you ship to Pune?',
    'inquiry_preview', 'Do you ship to Pune?',
    'integration_name', 'EasyShip',
    'intro_message', 'Would love an intro to Asha.',
    'invitation_message', 'Join our seller circle',
    'invitation_message_snippet', 'Join our seller circle…',
    'invite_message', 'Come join SHEconomy',
    'invited_user_name', 'Sonal Gupta',
    'invitee_name', 'Sonal Gupta',
    'inviter_name', 'Meera Joshi',
    'issue_label', 'return request',
    'item_count', '9',
    'item_summary', '9 items from women-led shops',
    'items_summary', '9 items · 11,596.00 INR',
    'kyc_status_label', 'Pending documents',
    'lesson_title', 'Pricing that converts',
    'liker_name', 'Rohit Das',
    'listing_price', '498.00 INR',
    'listing_title', 'Bio Gasrid Tablets',
    'listing_type', 'Physical goods'
  ) ||
           jsonb_build_object(
    'login_time', '19 Nov 2026, 10:15 IST',
    'low_stock_threshold', '5',
    'meeting_code', 'SHE-9021',
    'meeting_title', 'Weekly seller sync',
    'member_name', 'Isha Khan',
    'mentioner_name', 'Vikram Shah',
    'message', 'Thanks for shopping with SHEconomy!',
    'message_preview', 'Are these still available?',
    'milestone_value', '100 orders',
    'mismatch_count', '2',
    'mismatch_rate', '0.4%',
    'missing_count', '3',
    'missing_fields', 'GSTIN, bank proof, pickup address',
    'missing_fields_html', '<ul><li>GSTIN</li><li>Bank proof</li><li>Pickup address</li></ul>',
    'new_followers', '12',
    'new_price', '449.00 INR',
    'new_scheduled_at', '20 Nov 2026, 4:00 PM IST',
    'new_vendors', '7',
    'next_attempt_date', '20 Nov 2026',
    'offer_code', 'SHETEST20',
    'offer_name', 'Welcome 20',
    'old_price', '498.00 INR',
    'old_scheduled_at', '19 Nov 2026, 4:00 PM IST',
    'order_count', '3',
    'order_number', 'SHE-100245',
    'order_status_color', '#D81B60',
    'order_status_label', 'Shipped',
    'order_status_vendor_note', 'Handed to courier',
    'orders', '18',
    'original_comment_preview', 'Love the packaging!',
    'owner_name', 'Sanjeev Shukla',
    'participant_count', '6',
    'participant_name', 'Pooja Nair',
    'payment_method', 'UPI',
    'payment_status', 'Paid',
    'period', 'last 7 days',
    'pick_count', '5',
    'pick_summary', 'Handmade candle, tote, atta & more',
    'platform', 'SHEconomy',
    'post_preview', 'Excited to launch our new collection…'
  ) ||
           jsonb_build_object(
    'processing_time', '2 hours',
    'product_name', 'MP Fresh Multigrain Atta – 5 KG',
    'product_title', 'MP Fresh Multigrain Atta – 5 KG',
    'profile_completion_percentage', '72',
    'profile_id', '589ae4f0-7b9c-4c51-8c3f-7be87fc057af',
    'profile_tip', 'Add a profile photo to build trust',
    'profile_views', '38',
    'rank_label', '#12 in Home',
    'rating', '5',
    'reaction_type', 'like',
    'reactor_name', 'Ayesha Khan',
    'reason', 'Address unreachable',
    'receiver_name', 'Sanjeev Shukla',
    'recent_orders', '5',
    'recommendation_preview', 'Exceptional quality and service',
    'recommender_name', 'Deepa Iyer',
    'refund_amount', '499.00 INR',
    'refund_method', 'Original payment method',
    'registration_end_date', '25 Nov 2026',
    'registration_start_date', '10 Nov 2026',
    'reject_reason', 'Incomplete documents',
    'rejection_reason', 'Incomplete documents',
    'replier_name', 'Sneha Paul',
    'reply_preview', 'Yes, we ship pan-India.',
    'reposter_name', 'Arjun Malhotra',
    'requester_name', 'Nisha Reddy',
    'required_documents', 'PAN, GST, cancelled cheque',
    'resolution_note', 'Refund initiated',
    'resolution_summary', 'Approved and refunded',
    'revocation_reason', 'Document mismatch',
    'reward_amount', '50.00 INR',
    'risk_score', 'low',
    'room_id', 'room-42',
    'scheduled_at', '20 Nov 2026, 5:00 PM IST',
    'season_name', 'Festive',
    'seller_name', 'Wheat Raja',
    'sender_name', 'Support Team',
    'shipping_address', '12 MG Road, Bengaluru 560001',
    'shop_currency', 'INR',
    'shop_id', '00000000-0000-0000-0000-000000000001'
  ) ||
           jsonb_build_object(
    'shop_name', 'Wheat Raja',
    'shop_names', 'Wheat Raja, Bioayurveda',
    'shop_owner_name', 'Ramesh Kumar',
    'shop_verified', 'true',
    'skill_name', 'Product photography',
    'start_date', '19 Nov 2026',
    'starts_at', '20 Nov 2026, 5:00 PM IST',
    'starts_in', '30 minutes',
    'stock_cover_days', '6',
    'suggested_restock_qty', '25',
    'suggestion_count', '8',
    'suggestion_preview', 'People you may know in Delhi',
    'suspension_reason', 'Policy review',
    'target_name', 'Asha Verma',
    'tier_name', 'Growth',
    'total_items', '9',
    'tracking_number', 'TRK123456789',
    'transaction_id', 'pay_TEST123',
    'unread_count', '3',
    'user_name', 'Sanjeev',
    'vendor_cod_amount', '1,199.00',
    'vendor_email', 'vendor@example.com',
    'vendor_name', 'Wheat Raja',
    'vendor_order_value', '1,199.00',
    'vendor_payment_amount', '1,050.00',
    'vendor_summary', '3 open orders need confirmation',
    'verification_date', '18 Nov 2026',
    'viewer_name', 'Tanvi Shah',
    'views', '1,240',
    'item_count', '9',
    'order_id', '00000000-0000-0000-0000-000000000099',
    'product_id', '00000000-0000-0000-0000-000000000088',
    'conversation_id', '00000000-0000-0000-0000-000000000077',
    'stage', 9001,
    '_test_batch', true,
    '_test_label', 'mailchimp-template-sweep'
  );

  v_vars := v_vars || jsonb_build_object(
    'cart_items_html', COALESCE(
      public.build_user_cart_items_email_carousel(v_user, 'https://www.sheconomy.in', 'INR', 6),
      '<p style="margin:0;color:#5c5c6e;">Your saved cart items will appear here.</p>'
    ),
    'order_items_html', COALESCE(
      public.build_user_cart_items_email_carousel(v_user, 'https://www.sheconomy.in', 'INR', 4),
      '<p style="margin:0;color:#5c5c6e;">Order items will appear here.</p>'
    ),
    'listing_card_html', COALESCE(
      (
        SELECT public.build_listing_promo_email_html(ci.listing_id, 'https://www.sheconomy.in', 'INR', ci.unit_price)
        FROM public.cart_items ci
        JOIN public.carts c ON c.id = ci.cart_id
        WHERE c.user_id = v_user AND ci.listing_id IS NOT NULL
        ORDER BY ci.updated_at DESC NULLS LAST
        LIMIT 1
      ),
      ''
    )
  );

  FOR r IN
    SELECT
      t.id AS template_id,
      t.template_key,
      t.category,
      t.platform,
      t.title_template,
      t.message_template,
      t.action_url_template,
      t.default_priority
    FROM public.notification_templates t
    WHERE t.is_active = true
      AND coalesce(t.email_body_template, '') <> ''
    ORDER BY t.category, t.template_key
  LOOP
    BEGIN
      v_title := public.substitute_template_variables(r.title_template, v_vars);
      v_message := public.substitute_template_variables(r.message_template, v_vars);
      IF coalesce(trim(v_title), '') = '' THEN
        v_title := '[TEST] ' || r.template_key;
      ELSE
        v_title := '[TEST] ' || v_title;
      END IF;
      IF coalesce(trim(v_message), '') = '' THEN
        v_message := 'Mailchimp template preview for ' || r.template_key;
      END IF;

      v_action := NULL;
      IF r.action_url_template IS NOT NULL THEN
        v_action := public.substitute_template_variables(r.action_url_template, v_vars);
      END IF;

      INSERT INTO public.notifications (
        recipient_id,
        user_id,
        context_type,
        context_id,
        type,
        template_id,
        category,
        title,
        message,
        data,
        action_url,
        priority,
        channels,
        platform,
        source_system
      ) VALUES (
        v_user,
        v_user,
        NULL,
        NULL,
        r.template_key,
        r.template_id,
        r.category,
        v_title,
        v_message,
        v_vars || jsonb_build_object(
          'template_key', r.template_key,
          'email_subject_prefix', '[TEST] '
        ),
        v_action,
        LEAST(GREATEST(COALESCE(r.default_priority, 3), 1), 5),
        ARRAY['email']::text[],
        r.platform,
        'application'
      )
      RETURNING id INTO v_id;

      INSERT INTO public.notification_event_queue (
        event_key, recipient_id, payload, scheduled_for, status
      ) VALUES (
        'dispatch_notification',
        v_user,
        jsonb_build_object(
          'notification_id', v_id,
          'template_key', r.template_key,
          'test_batch', 'mailchimp-template-sweep'
        ),
        now(),
        'pending'
      );

      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      RAISE NOTICE 'FAIL %: %', r.template_key, v_err;
    END;
  END LOOP;

  RAISE NOTICE 'Queued test emails ok=% fail=%', v_ok, v_fail;
END $$;

SELECT COUNT(*) AS pending_test_dispatches
FROM notification_event_queue
WHERE status = 'pending'
  AND payload->>'test_batch' = 'mailchimp-template-sweep';
