-- Convert legacy full-HTML email templates into content fragments.
-- Shared branded chrome is applied at send time via wrapEmailHtml.

UPDATE public.notification_templates
SET
  email_body_template = $html$<h2 style="margin:0 0 10px;font-size:26px;font-weight:800;color:#1a1a2e;line-height:1.3;">⚠️ Account Verification Status Changed</h2>
<p style="margin:0 0 8px;color:#5c5c6e;font-size:14px;">Important account update</p>
<p style="margin:0 0 20px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hello <strong style="color:#1a1a2e;">{{user_name}}</strong>, your account verification status has been updated. Your account is <strong style="color:#dc2626;">no longer verified</strong>. This may affect your access to certain features and services on the platform.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;"><tr><td style="padding:18px 22px;">
<p style="margin:0 0 12px;font-size:13px;font-weight:700;color:hsl(339,82%,46%);">⚠️ What this means:</p>
<ul style="margin:0;padding-left:20px;color:#1a1a2e;font-size:14px;line-height:1.8;">
<li>Limited access to premium features</li>
<li>Restricted community interactions</li>
<li>Reduced visibility in searches</li>
<li>Lower trust score with other members</li>
</ul>
</td></tr></table>
<div style="text-align:center;margin:24px 0;"><a href="{{base_url}}/support" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">Contact Support</a></div>
<p style="margin:0 0 24px;color:#9ca3af;font-size:14px;text-align:center;">For immediate assistance, you can also reply directly to this email.</p>$html$,
  updated_at = now()
WHERE template_key = 'account_unverified';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Account &bull; Verification Complete</p>
    <h2 style="margin:0 0 10px;font-size:28px;font-weight:800;color:#1a1a2e;line-height:1.2;">🎉 Account Verified Successfully!</h2>
    <p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hello <strong style="color:#1a1a2e;">{{user_name}}</strong>, your SHEconomy account has been successfully verified. You now have full access to all features and services on our platform.</p>

    <!-- Benefits card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;">
    <tr><td style="padding:18px 22px;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:hsl(339,82%,46%);">✅ What you can do now:</p>
      <ul style="margin:0;padding-left:20px;color:#1a1a2e;font-size:14px;line-height:1.8;">
        <li>Access all premium features</li>
        <li>Connect with verified members</li>
        <li>Participate in exclusive communities</li>
        <li>Access verified-only content</li>
        <li>Build trust with other members</li>
      </ul>
    </td></tr></table>

    <div style="text-align:center;margin:24px 0;">
      <a href="{{base_url}}/profile/{{profile_id}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">Go to Your Profile</a>
    </div>$html$,
  updated_at = now()
WHERE template_key = 'account_verified';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">COD Order &bull; Action Required</p>
<h2 style="margin:0 0 6px;font-size:30px;font-weight:800;color:#1a1a2e;line-height:1.2;">COD Order Received! 📦💰</h2>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi <strong style="color:#1a1a2e;">{{shop_owner_name}}</strong>, you have received a new Cash on Delivery order from <strong style="color:#1a1a2e;">{{customer_name}}</strong>. The payment will be collected upon delivery.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;"><tr><td style="padding:18px 22px;">
<p style="margin:0 0 12px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:0.8px;">Order Details</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Order Number</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{order_number}}
Your COD Amount</td><td style="font-size:14px;color:#1a1a2e;font-weight:700;padding:5px 0;">{{shop_currency}} {{vendor_cod_amount}}
Customer</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{customer_name}}
Payment Method</td><td style="font-size:14px;padding:5px 0;"><span style="background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 100%);color:#fff;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">Cash on Delivery</span></td></tr>
</table>
</td></tr></table>
<p style="margin:0 0 8px;color:#5c5c6e;font-size:13px;line-height:1.6;">{{currency_note}}</p>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:14px;line-height:1.6;">Please process and dispatch this order. The COD amount will be collected at the time of delivery.</p>

<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">View Order</a>$html$,
  updated_at = now()
WHERE template_key = 'cod_order_vendor';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Community &bull; Comment Liked</p>
<h2 style="margin:0 0 10px;font-size:26px;font-weight:800;color:#1a1a2e;line-height:1.3;">Someone liked your comment ❤️</h2>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;"><strong style="color:#1a1a2e;">{{liker_name}}</strong> liked your comment on SHEconomy Community.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;"><tr><td style="padding:18px 22px;">
<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:0.8px;">Your Comment</p>
<p style="margin:0;font-size:14px;color:#1a1a2e;line-height:1.7;font-style:italic;">"{{comment_preview}}"</p>
</td></tr></table>

<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">View Comment</a>$html$,
  updated_at = now()
WHERE template_key = 'comment_liked';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Community &bull; You Were Mentioned</p>
<h2 style="margin:0 0 10px;font-size:26px;font-weight:800;color:#1a1a2e;line-height:1.3;">You were mentioned in a comment 📣</h2>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;"><strong style="color:#1a1a2e;">{{mentioner_name}}</strong> mentioned you in a comment on SHEconomy Community.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;"><tr><td style="padding:18px 22px;">
<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:0.8px;">The Comment</p>
<p style="margin:0;font-size:14px;color:#1a1a2e;line-height:1.7;font-style:italic;">"{{comment_preview}}"</p>
</td></tr></table>

<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">View Comment</a>$html$,
  updated_at = now()
WHERE template_key = 'comment_mentioned';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Community &bull; Invitation Accepted</p><h2 style="margin:0 0 10px;font-size:28px;font-weight:800;color:#1a1a2e;line-height:1.2;">{{invited_user_name}} joined! ✅</h2><p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;"><strong style="color:#1a1a2e;">{{invited_user_name}}</strong> has accepted your invitation and joined <strong style="color:#1a1a2e;">{{group_name}}</strong>.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;"><tr><td style="padding:18px 22px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Group</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{group_name}}
New Member</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{invited_user_name}}
Status</td><td style="font-size:14px;padding:5px 0;"><span style="background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 100%);color:#fff;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">Accepted</span></td></tr></table></td></tr></table>
<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">View Group</a>$html$,
  updated_at = now()
WHERE template_key = 'group_invitation_accepted';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Community &bull; Invitation Cancelled</p><h2 style="margin:0 0 16px;font-size:26px;font-weight:800;color:#1a1a2e;line-height:1.2;">Invitation Cancelled</h2><p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;"><strong style="color:#1a1a2e;">{{inviter_name}}</strong> has cancelled the invitation to join <strong style="color:#1a1a2e;">{{group_name}}</strong>.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;"><tr><td style="padding:18px 22px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Group</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{group_name}}
Cancelled By</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{inviter_name}}
Status</td><td style="font-size:14px;padding:5px 0;"><span style="background:hsl(339,20%,88%);color:hsl(339,82%,46%);padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">Cancelled</span></td></tr></table></td></tr></table>
<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">Explore Groups</a>$html$,
  updated_at = now()
WHERE template_key = 'group_invitation_cancelled';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Community &bull; Invitation Declined</p><h2 style="margin:0 0 16px;font-size:26px;font-weight:800;color:#1a1a2e;line-height:1.2;">Invitation Declined ↩️</h2><p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;"><strong style="color:#1a1a2e;">{{invited_user_name}}</strong> has declined your invitation to join <strong style="color:#1a1a2e;">{{group_name}}</strong>.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;"><tr><td style="padding:18px 22px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Group</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{group_name}}
Invited User</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{invited_user_name}}
Status</td><td style="font-size:14px;padding:5px 0;"><span style="background:#f3f4f6;color:#6b7280;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">Declined</span></td></tr></table></td></tr></table>
<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">View Group</a>$html$,
  updated_at = now()
WHERE template_key = 'group_invitation_declined';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Community &bull; Group Invitation</p>
<h2 style="margin:0 0 10px;font-size:28px;font-weight:800;color:#1a1a2e;line-height:1.2;">You're Invited! 👥</h2>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;"><strong style="color:#1a1a2e;">{{inviter_name}}</strong> has personally invited you to join the group <strong style="color:#1a1a2e;">{{group_name}}</strong> on SHEconomy. Connect with like-minded women entrepreneurs and grow together!</p>

<!-- Invitation Details card with warm gradient -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:16px;">
<tr><td style="padding:18px 22px;">
<p style="margin:0 0 12px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:0.8px;">Invitation Details</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Group</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{group_name}}
Invited By</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{inviter_name}}
Message</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{invitation_message}}</td></tr>
</table>
</td></tr></table>

<p style="margin:0 0 24px;color:#5c5c6e;font-size:14px;line-height:1.6;">Click below to view the group and accept the invitation. This invitation is pending your response.</p>


<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">View Invitation</a>
</td></tr>

<!-- Footer with warm gradient -->$html$,
  updated_at = now()
WHERE template_key = 'group_invitation_received';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Listing Update &bull; Archived</p>
<h2 style="margin:0 0 16px;font-size:26px;font-weight:800;color:#1a1a2e;line-height:1.2;">"{{listing_title}}" archived 📦</h2>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi <strong style="color:#1a1a2e;">{{vendor_name}}</strong>, your listing <strong style="color:#1a1a2e;">{{listing_title}}</strong> in <strong style="color:#1a1a2e;">{{shop_name}}</strong> has been archived.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;"><tr><td style="padding:18px 22px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Title</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{listing_title}}
Shop</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{shop_name}}
Shop Status</td><td style="font-size:14px;padding:5px 0;"><span style="background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 100%);color:#fff;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">{{shop_verified}}</span>
Status</td><td style="font-size:14px;padding:5px 0;"><span style="background:hsl(339,20%,88%);color:hsl(339,82%,46%);padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">Archived</span></td></tr>
</table></td></tr></table>

<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">View My Listings</a>$html$,
  updated_at = now()
WHERE template_key = 'listing_archived';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Action Required &bull; Listing Details</p>
<h2 style="margin:0 0 10px;font-size:28px;font-weight:800;color:#1a1a2e;line-height:1.2;">📦 Your listing needs more details</h2>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi <strong style="color:#1a1a2e;">{{vendor_name}}</strong>, your listing <strong style="color:#1a1a2e;">"{{listing_title}}"</strong> in shop <strong style="color:#1a1a2e;">{{shop_name}}</strong> is missing some important information. Completing these details helps your product appear in more searches and converts more browsers into buyers.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:16px;"><tr><td style="padding:18px 22px;"><p style="margin:0 0 12px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:0.8px;">Missing Information</p><p style="margin:0;font-size:14px;color:#1a1a2e;line-height:1.8;">{{missing_fields_html}}</p></td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;"><tr><td style="padding:14px 22px;"><p style="margin:0;font-size:13px;color:#1a1a2e;line-height:1.6;"><strong style="color:hsl(339,82%,46%);">Tip:</strong> Listings with full details, good images, weight, and SEO title receive up to <strong>4x more clicks</strong> from search results.</p></td></tr></table>

<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">Complete This Listing</a>$html$,
  updated_at = now()
WHERE template_key = 'listing_incomplete';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Inventory Alert &bull; Action Needed</p>
<h2 style="margin:0 0 16px;font-size:26px;font-weight:800;color:#1a1a2e;line-height:1.2;">Out of stock ⚠️</h2>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi <strong style="color:#1a1a2e;">{{vendor_name}}</strong>, your listing <strong style="color:#1a1a2e;">{{listing_title}}</strong> in <strong style="color:#1a1a2e;">{{shop_name}}</strong> has run out of stock and has been automatically hidden from customer searches. Update your inventory to restore visibility.</p>

<!-- Listing Details card with warm gradient -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;">
<tr><td style="padding:18px 22px;">
<p style="margin:0 0 12px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:0.8px;">Listing Details</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Title</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{listing_title}}
Shop</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{shop_name}}
Shop Status</td><td style="font-size:14px;padding:5px 0;">
<span style="background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 100%);color:#fff;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">{{shop_verified}}</span>

Current Stock</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">0 units
Status</td><td style="font-size:14px;padding:5px 0;">
<span style="background:#fef3c7;color:#d97706;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">Out of Stock</span>
</td></tr>
</table>
</td></tr></table>

<p style="margin:0 0 24px;color:#5c5c6e;font-size:14px;line-height:1.6;">Head to your listings dashboard to update the stock quantity and make this listing visible again.</p>


<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">Update Stock</a>
</td></tr>

<!-- Footer with warm gradient -->$html$,
  updated_at = now()
WHERE template_key = 'listing_out_of_stock';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Listing Update &bull; Paused</p>
<h2 style="margin:0 0 16px;font-size:26px;font-weight:800;color:#1a1a2e;line-height:1.2;">"{{listing_title}}" is paused ⏸️</h2>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi <strong style="color:#1a1a2e;">{{vendor_name}}</strong>, your listing <strong style="color:#1a1a2e;">{{listing_title}}</strong> in <strong style="color:#1a1a2e;">{{shop_name}}</strong> is now paused and temporarily hidden from the marketplace.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;"><tr><td style="padding:18px 22px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Title</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{listing_title}}
Shop</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{shop_name}}
Shop Status</td><td style="font-size:14px;padding:5px 0;"><span style="background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 100%);color:#fff;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">{{shop_verified}}</span>
Status</td><td style="font-size:14px;padding:5px 0;"><span style="background:hsl(339,20%,88%);color:hsl(339,82%,46%);padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">Paused</span></td></tr>
</table>
</td></tr></table>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:14px;line-height:1.6;">You can resume this listing from your dashboard whenever you are ready to sell again.</p>

<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">Manage Listing</a>$html$,
  updated_at = now()
WHERE template_key = 'listing_paused';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Listing Live &bull; Published Successfully</p>
<h2 style="margin:0 0 10px;font-size:28px;font-weight:800;color:#1a1a2e;line-height:1.2;">Your listing is live! 🎉</h2>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi <strong style="color:#1a1a2e;">{{vendor_name}}</strong>, your {{listing_type}} listing <strong style="color:#1a1a2e;">{{listing_title}}</strong> is now live on <strong style="color:#1a1a2e;">{{shop_name}}</strong> and visible to customers across SHEconomy.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;"><tr><td style="padding:18px 22px;">
<p style="margin:0 0 12px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:0.8px;">Listing Details</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Title</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{listing_title}}
Type</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;text-transform:capitalize;">{{listing_type}}
Shop</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{shop_name}}
Price</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{currency}}{{listing_price}}
Shop</td><td style="font-size:14px;padding:5px 0;"><span style="background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 100%);color:#fff;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">{{shop_verified}}</span>
Status</td><td style="font-size:14px;padding:5px 0;"><span style="background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 100%);color:#fff;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">Live</span></td></tr>
</table>
</td></tr></table>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:14px;line-height:1.6;">Customers can now discover and purchase this listing. Share it to boost your first sales!</p>

<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">View Listing</a>$html$,
  updated_at = now()
WHERE template_key = 'listing_published';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Action Needed &bull; Shop Not Verified</p>
<h2 style="margin:0 0 10px;font-size:26px;font-weight:800;color:#1a1a2e;line-height:1.3;">Listing saved, but customers can't see it yet 🔒</h2>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi <strong style="color:#1a1a2e;">{{vendor_name}}</strong>, your listing <strong style="color:#1a1a2e;">{{listing_title}}</strong> has been saved to <strong style="color:#1a1a2e;">{{shop_name}}</strong>. However, your shop is not verified yet, so this listing is hidden.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:20px;"><tr><td style="padding:18px 22px;">
<p style="margin:0 0 12px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:0.8px;">Listing Details</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Title</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{listing_title}}
Shop</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{shop_name}}
Shop Status</td><td style="font-size:14px;padding:5px 0;"><span style="background:#fef3c7;color:#d97706;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">Not Verified</span>
Listing Visible</td><td style="font-size:14px;padding:5px 0;"><span style="background:#fee2e2;color:#dc2626;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">Hidden from customers</span></td></tr>
</table>
</td></tr></table>

<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">Verify My Shop</a>$html$,
  updated_at = now()
WHERE template_key = 'listing_published_shop_unverified';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Listing Update &bull; Sold Out</p>
<h2 style="margin:0 0 16px;font-size:26px;font-weight:800;color:#1a1a2e;line-height:1.2;">"{{listing_title}}" is sold out 🏷️</h2>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi <strong style="color:#1a1a2e;">{{vendor_name}}</strong>, your listing <strong style="color:#1a1a2e;">{{listing_title}}</strong> in <strong style="color:#1a1a2e;">{{shop_name}}</strong> has been marked as sold out. New customers will not see it in search results.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;"><tr><td style="padding:18px 22px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Title</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{listing_title}}
Type</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;text-transform:capitalize;">{{listing_type}}
Shop</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{shop_name}}
Shop Status</td><td style="font-size:14px;padding:5px 0;"><span style="background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 100%);color:#fff;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">{{shop_verified}}</span>
Price</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{currency}}{{listing_price}}
Status</td><td style="font-size:14px;padding:5px 0;"><span style="background:hsl(339,20%,88%);color:hsl(339,82%,46%);padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">Sold Out</span></td></tr>
</table>
</td></tr></table>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:14px;line-height:1.6;">When you have new stock available, re-activate this listing from your dashboard to start selling again.</p>

<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">Manage Listing</a>$html$,
  updated_at = now()
WHERE template_key = 'listing_sold_out';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Inventory Alert &bull; Low Stock</p>
<h2 style="margin:0 0 6px;font-size:28px;font-weight:800;color:#1a1a2e;line-height:1.2;">Low Stock Alert 📉</h2>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi <strong style="color:#1a1a2e;">{{shop_owner_name}}</strong>, your product <strong style="color:#1a1a2e;">{{product_title}}</strong> is running low on stock. Restock soon to avoid losing sales.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;"><tr><td style="padding:18px 22px;">
<p style="margin:0 0 12px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:0.8px;">Stock Details</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Product</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{product_title}}
Current Stock</td><td style="font-size:14px;padding:5px 0;"><span style="background:#fef3c7;color:#d97706;padding:3px 12px;border-radius:20px;font-size:13px;font-weight:700;">{{current_stock}} remaining</span>
Low Stock Threshold</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{low_stock_threshold}} units
Recent Orders</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{recent_orders}}
Status</td><td style="font-size:14px;padding:5px 0;"><span style="background:#fef3c7;color:#d97706;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">Low Stock</span></td></tr>
</table>
</td></tr></table>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:14px;line-height:1.6;">Restock your inventory now to keep selling without interruption. Listings that run out of stock are automatically hidden from customers.</p>

<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">Restock Now</a>$html$,
  updated_at = now()
WHERE template_key = 'low_stock_alert_vendor';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Co-Work &bull; Meeting Ended</p>
<h2 style="margin:0 0 10px;font-size:26px;font-weight:800;color:#1a1a2e;line-height:1.3;">Meeting ended 👋</h2>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi <strong style="color:#1a1a2e;">{{participant_name}}</strong>, the meeting <strong style="color:#1a1a2e;">"{{meeting_title}}"</strong> has ended. Thanks for participating!</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;"><tr><td style="padding:18px 22px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Meeting</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{meeting_title}}
Duration</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{duration_minutes}} minutes
Participants</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{participant_count}}
Status</td><td style="font-size:14px;padding:5px 0;"><span style="background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 100%);color:#fff;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">Ended</span></td></tr>
</table>
</td></tr></table>

<a href="https://sheconomy.in/co-work" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">View History</a>$html$,
  updated_at = now()
WHERE template_key = 'meeting_ended';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Co-Work &bull; Meeting Invitation</p>
<h2 style="margin:0 0 10px;font-size:26px;font-weight:800;color:#1a1a2e;line-height:1.3;">You're invited to a meeting! 📹</h2>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi <strong style="color:#1a1a2e;">{{invitee_name}}</strong>, <strong style="color:#1a1a2e;">{{host_name}}</strong> has invited you to join a meeting on SHEconomy Co-Work.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;"><tr><td style="padding:18px 22px;">
<p style="margin:0 0 12px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:0.8px;">Meeting Details</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Title</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{meeting_title}}
Host</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{host_name}}
Scheduled</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{scheduled_at}}
Room ID</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{room_id}}
Status</td><td style="font-size:14px;padding:5px 0;"><span style="background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 100%);color:#fff;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">Invited</span></td></tr>
</table>
</td></tr></table>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:14px;line-height:1.6;">As an invited participant, you can join without entering a passcode. Click the button below to join.</p>

<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">Join Meeting</a>$html$,
  updated_at = now()
WHERE template_key = 'meeting_invitation';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Co-Work &bull; Recording Ready</p>
<h2 style="margin:0 0 10px;font-size:26px;font-weight:800;color:#1a1a2e;line-height:1.3;">Your recording is ready! 🎥</h2>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi <strong style="color:#1a1a2e;">{{participant_name}}</strong>, the recording for <strong style="color:#1a1a2e;">"{{meeting_title}}"</strong> is now available to watch.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;"><tr><td style="padding:18px 22px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Meeting</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{meeting_title}}
Duration</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{duration_minutes}} minutes
Status</td><td style="font-size:14px;padding:5px 0;"><span style="background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 100%);color:#fff;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">Ready to Watch</span></td></tr>
</table>
</td></tr></table>

<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">Watch Recording</a>$html$,
  updated_at = now()
WHERE template_key = 'meeting_recording_available';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Co-Work &bull; Meeting Reminder</p>
<h2 style="margin:0 0 10px;font-size:26px;font-weight:800;color:#1a1a2e;line-height:1.3;">Starting in 30 minutes ⏰</h2>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi <strong style="color:#1a1a2e;">{{invitee_name}}</strong>, your meeting <strong style="color:#1a1a2e;">"{{meeting_title}}"</strong> starts in 30 minutes. Get ready to join!</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;"><tr><td style="padding:18px 22px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Meeting</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{meeting_title}}
Host</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{host_name}}
Start Time</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{scheduled_at}}</td></tr>
</table>
</td></tr></table>

<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">Join Meeting</a>$html$,
  updated_at = now()
WHERE template_key = 'meeting_reminder_30min';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:1.5px;">Co-Work &bull; Starting Now</p>
<h2 style="margin:0 0 10px;font-size:26px;font-weight:800;color:#1a1a2e;line-height:1.3;">Starting in 5 minutes! 🚀</h2>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi <strong style="color:#1a1a2e;">{{invitee_name}}</strong>, <strong style="color:#1a1a2e;">"{{meeting_title}}"</strong> starts in just 5 minutes. <strong style="color:#1a1a2e;">{{host_name}}</strong> is waiting for you!</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border-radius:12px;border:1px solid #fecaca;margin-bottom:24px;"><tr><td style="padding:18px 22px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Meeting</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{meeting_title}}
Host</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{host_name}}
Time</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{scheduled_at}}
Status</td><td style="font-size:14px;padding:5px 0;"><span style="background:#fee2e2;color:#dc2626;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">Starting in 5 min</span></td></tr>
</table>
</td></tr></table>

<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(239,68,68,0.40);letter-spacing:0.3px;">Join Now</a>$html$,
  updated_at = now()
WHERE template_key = 'meeting_reminder_5min';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Co-Work &bull; Meeting Rescheduled</p>
<h2 style="margin:0 0 10px;font-size:26px;font-weight:800;color:#1a1a2e;line-height:1.3;">Meeting rescheduled 📅</h2>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi <strong style="color:#1a1a2e;">{{invitee_name}}</strong>, <strong style="color:#1a1a2e;">{{host_name}}</strong> has rescheduled <strong style="color:#1a1a2e;">"{{meeting_title}}"</strong> to a new time.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;"><tr><td style="padding:18px 22px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Meeting</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{meeting_title}}
New Time</td><td style="font-size:14px;color:hsl(339,82%,46%);font-weight:700;padding:5px 0;">{{new_scheduled_at}}
Previous Time</td><td style="font-size:14px;color:#9ca3af;padding:5px 0;text-decoration:line-through;">{{old_scheduled_at}}
Host</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{host_name}}</td></tr>
</table>
</td></tr></table>

<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">View Meeting</a>$html$,
  updated_at = now()
WHERE template_key = 'meeting_rescheduled';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">New Order &bull; Action Required</p>
<h2 style="margin:0 0 6px;font-size:30px;font-weight:800;color:#1a1a2e;line-height:1.2;">New Order Received! 🛒</h2>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi <strong style="color:#1a1a2e;">{{shop_owner_name}}</strong>, you have received a new order from <strong style="color:#1a1a2e;">{{customer_name}}</strong>. Please confirm within 24 hours to avoid auto-cancellation.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;"><tr><td style="padding:18px 22px;">
<p style="margin:0 0 12px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:0.8px;">Order Details</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Order Number</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{order_number}}
Your Earning</td><td style="font-size:14px;color:#1a1a2e;font-weight:700;padding:5px 0;">{{shop_currency}} {{vendor_order_value}}
Items</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{item_count}}
Customer</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{customer_name}}
Payment</td><td style="font-size:14px;padding:5px 0;"><span style="background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 100%);color:#fff;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">{{payment_status}}</span></td></tr>
</table>
</td></tr></table>
<p style="margin:0 0 8px;color:#5c5c6e;font-size:13px;line-height:1.6;">{{currency_note}}</p>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:14px;line-height:1.6;">Please confirm or reject this order from your vendor dashboard within 24 hours.</p>

<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">Confirm Order</a>$html$,
  updated_at = now()
WHERE template_key = 'new_order_vendor';

UPDATE public.notification_templates
SET
  email_body_template = $html$<!-- Body -->
      <tr><td style="padding:32px 40px 8px;">
        <h2 style="margin:0 0 6px;font-size:28px;font-weight:800;color:#1a1a2e;text-align:center;">Complete Your Payment ⏳</h2>
        <p style="margin:0 0 6px;color:#5c5c6e;font-size:15px;line-height:1.7;text-align:center;">
          Hi <strong style="color:#1a1a2e;">{{customer_name}}</strong>, your order has been created but payment is pending.
          Complete your payment to confirm the order.
        </p>
        <p style="margin:0 0 24px;color:hsl(339,82%,46%);font-size:14px;font-weight:700;text-align:center;">ORDER #{{order_number}}</p>

        <div style="text-align:center;margin-bottom:32px;">
          <a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg,hsl(339,82%,46%) 0%,hsl(339,90%,45%) 50%,hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);">Complete Payment</a>
        </div>

        <!-- Order Summary -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,hsl(30,50%,98%) 0%,hsl(339,30%,95%) 50%,hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;">
        <tr><td style="padding:18px 22px;">
          <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:hsl(339,82%,46%);">Order summary</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
            <tr><td style="padding:6px 0;color:#78716c;">Items ({{total_items}})</td><td align="right" style="padding:6px 0;color:#1a1a2e;">{{customer_currency}} {{customer_subtotal_amount}}
Shipping</td><td align="right" style="padding:6px 0;color:#1a1a2e;">{{customer_currency}} {{customer_shipping_amount}}
Tax</td><td align="right" style="padding:6px 0;color:#1a1a2e;">{{customer_currency}} {{customer_tax_amount}}
Discount</td><td align="right" style="padding:6px 0;color:#16a34a;">-{{customer_currency}} {{customer_discount_amount}}
Total Due</td>
              <td align="right" style="padding:12px 0;font-weight:700;color:hsl(339,82%,46%);border-top:2px solid hsl(339,20%,88%);">{{customer_currency}} {{customer_total_amount}}</td>
            </tr>
          </table>
        </td></tr></table>

        <!-- Warning banner -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fef9e7;border-left:4px solid #f59e0b;border-radius:4px;margin-bottom:24px;">
        <tr><td style="padding:16px;font-size:14px;color:#92400e;">
          <strong>⚠️ Payment Pending</strong><br/>
          Your order is reserved but will not be confirmed until payment is complete.
          Items may become unavailable if payment is not completed soon.
        </td></tr></table>

        <!-- Shipping address -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,hsl(30,50%,98%) 0%,hsl(339,30%,95%) 50%,hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;">
        <tr><td style="padding:16px 22px;font-size:14px;">
          <strong style="color:hsl(339,82%,46%);">Shipping to:</strong><br/>
          <span style="color:#5c5c6e;">{{shipping_address}}</span>
        </td></tr></table>$html$,
  updated_at = now()
WHERE template_key = 'order_awaiting_payment';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:1.5px;">Order Update &bull; Cancelled</p>
<h2 style="margin:0 0 6px;font-size:28px;font-weight:800;color:#1a1a2e;line-height:1.2;">Order Cancelled ❌</h2>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi <strong style="color:#1a1a2e;">{{customer_name}}</strong>, your order <strong style="color:#1a1a2e;">{{order_number}}</strong> has been cancelled. Reason: <strong style="color:#1a1a2e;">{{cancellation_reason}}</strong>.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border-radius:12px;border:1px solid #fecaca;margin-bottom:24px;"><tr><td style="padding:18px 22px;">
<p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.8px;">Cancellation Details</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Order Number</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{order_number}}
Reason</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{cancellation_reason}}
Refund Amount</td><td style="font-size:14px;color:#1a1a2e;font-weight:700;padding:5px 0;">{{customer_currency}} {{customer_refund_amount}}
Refund Method</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{refund_method}}
Processing Time</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">3–5 business days
Status</td><td style="font-size:14px;padding:5px 0;"><span style="background:#fee2e2;color:#dc2626;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">Cancelled</span></td></tr>
</table>
</td></tr></table>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:14px;line-height:1.6;">Your refund of <strong style="color:#1a1a2e;">{{customer_currency}} {{customer_refund_amount}}</strong> will be processed within 3–5 business days via <strong>{{refund_method}}</strong>.</p>

<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">View Order Details</a>$html$,
  updated_at = now()
WHERE template_key = 'order_cancelled_customer';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Urgent Reminder &bull; Confirmation Required</p>
<h2 style="margin:0 0 6px;font-size:28px;font-weight:800;color:#1a1a2e;line-height:1.2;">Confirm Order {{order_number}} ⏰</h2>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi <strong style="color:#1a1a2e;">{{shop_owner_name}}</strong>, order <strong style="color:#1a1a2e;">{{order_number}}</strong> is still awaiting your confirmation. You have <strong style="color:#d97706;">{{hours_remaining}} hours</strong> remaining before it is automatically cancelled.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;"><tr><td style="padding:18px 22px;">
<p style="margin:0 0 12px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:0.8px;">Order Details</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Order Number</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{order_number}}
Your Earning</td><td style="font-size:14px;color:#1a1a2e;font-weight:700;padding:5px 0;">{{shop_currency}} {{vendor_order_value}}
Customer</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{customer_name}}
Time Remaining</td><td style="font-size:14px;padding:5px 0;"><span style="background:#fef3c7;color:#d97706;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">{{hours_remaining}} hours</span></td></tr>
</table>
</td></tr></table>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:14px;line-height:1.6;">Confirm now to secure your sale. If no action is taken, the order will be automatically cancelled once the timer expires.</p>

<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">Confirm Now</a>$html$,
  updated_at = now()
WHERE template_key = 'order_confirmation_reminder_vendor';

UPDATE public.notification_templates
SET
  email_body_template = $html$<h2 style="margin:0 0 6px;font-size:28px;font-weight:800;color:#1a1a2e;line-height:1.2;">Thank you for your purchase!</h2>
<p style="margin:0 0 6px;color:#5c5c6e;font-size:15px;line-height:1.7;">We're getting your order ready to be shipped. We'll notify you once it's on the way.</p>
<p style="margin:0 0 24px;color:hsl(339,82%,46%);font-size:14px;font-weight:700;">ORDER #{{order_number}}</p>
<div style="text-align:center;margin-bottom:32px;"><a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">{{action_button_text}}</a></div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;"><tr><td style="padding:18px 22px;">
<p style="margin:0 0 12px;font-size:13px;font-weight:700;color:hsl(339,82%,46%);">Order summary</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
<tr><td style="padding:10px 0;color:#1a1a2e;">{{item_summary}}</td><td align="right" style="padding:10px 0;font-weight:700;color:#1a1a2e;">{{customer_currency}} {{customer_subtotal_amount}}
Subtotal</td><td align="right" style="padding:6px 0;color:#1a1a2e;">{{customer_currency}} {{customer_subtotal_amount}}
Shipping</td><td align="right" style="padding:6px 0;color:#1a1a2e;">{{customer_currency}} {{customer_shipping_amount}}
Taxes</td><td align="right" style="padding:6px 0;color:#1a1a2e;">{{customer_currency}} {{customer_tax_amount}}
Discount</td><td align="right" style="padding:6px 0;color:#16a34a;">-{{customer_currency}} {{customer_discount_amount}}
Total</td><td align="right" style="padding:12px 0;font-weight:700;color:hsl(339,82%,46%);border-top:2px solid hsl(339,20%,88%);">{{customer_currency}} {{customer_total_amount}}</td></tr>
</table></td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;"><tr><td style="padding:18px 22px;">
<p style="margin:0 0 12px;font-size:13px;font-weight:700;color:hsl(339,82%,46%);">Customer information</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
<tr><td width="50%" valign="top" style="padding-top:10px;"><strong style="color:#1a1a2e;">Shipping address</strong><br/><span style="color:#5c5c6e;">{{shipping_address}}</span></td><td width="50%" valign="top" style="padding-top:10px;"><strong style="color:#1a1a2e;">Billing address</strong><br/><span style="color:#5c5c6e;">{{billing_address}}</span>
<strong style="color:#1a1a2e;">Shipping method</strong><br/><span style="color:#5c5c6e;">{{shipping_method}}</span>
<strong style="color:#1a1a2e;">Payment method</strong><br/><span style="color:#5c5c6e;">{{payment_mode}}</span></td></tr>
</table></td></tr></table>$html$,
  updated_at = now()
WHERE template_key = 'order_confirmed_customer';

UPDATE public.notification_templates
SET
  email_body_template = $html$<h2 style="margin:0 0 6px;font-size:28px;font-weight:800;color:#1a1a2e;line-height:1.2;text-align:center;">Order Placed Successfully! 🎉</h2>
        <p style="margin:0 0 6px;color:#5c5c6e;font-size:15px;line-height:1.7;text-align:center;">Thank you for your order, <strong style="color:#1a1a2e;">{{customer_name}}</strong>! We've received your order and will notify you once the vendor confirms it.</p>
        <p style="margin:0 0 24px;color:hsl(339,82%,46%);font-size:14px;font-weight:700;text-align:center;">ORDER #{{order_number}}</p>

        <div style="text-align:center;margin-bottom:32px;">
          <a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">{{action_button_text}}</a>
        </div>

        <!-- Order Summary card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;">
        <tr><td style="padding:18px 22px;">
          <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:hsl(339,82%,46%);">Order summary</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
            <tr><td style="padding:10px 0;color:#78716c;"><strong style="color:#1a1a2e;">{{total_items}} item(s)</strong><br/><span style="font-size:13px;">From {{shop_names}}</span></td><td align="right" style="padding:10px 0;font-weight:700;color:#1a1a2e;">{{customer_currency}} {{customer_subtotal_amount}}
Subtotal</td><td align="right" style="padding:6px 0;color:#1a1a2e;">{{customer_currency}} {{customer_subtotal_amount}}
Shipping</td><td align="right" style="padding:6px 0;color:#1a1a2e;">{{customer_currency}} {{customer_shipping_amount}}
Taxes</td><td align="right" style="padding:6px 0;color:#1a1a2e;">{{customer_currency}} {{customer_tax_amount}}
Discount</td><td align="right" style="padding:6px 0;color:#16a34a;">-{{customer_currency}} {{customer_discount_amount}}
Total</td><td align="right" style="padding:12px 0;font-weight:700;color:hsl(339,82%,46%);border-top:2px solid hsl(339,20%,88%);">{{customer_currency}} {{customer_total_amount}}</td></tr>
          </table>
        </td></tr></table>

        <!-- Payment Method -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;">
        <tr><td style="padding:16px 22px;font-size:14px;">
          <strong style="color:hsl(339,82%,46%);">Payment Method:</strong><br/>
          <span style="color:#5c5c6e;">{{payment_mode}}</span>
        </td></tr></table>

        <!-- Delivery info -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;">
        <tr><td style="padding:18px 22px;">
          <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:hsl(339,82%,46%);">Delivery information</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
            <tr><td width="50%" valign="top" style="padding-top:10px;"><strong style="color:#1a1a2e;">Shipping address</strong><br/><span style="color:#5c5c6e;">{{shipping_address}}</span></td><td width="50%" valign="top" style="padding-top:10px;"><strong style="color:#1a1a2e;">Billing address</strong><br/><span style="color:#5c5c6e;">{{billing_address}}</span>
<strong style="color:#1a1a2e;">Shipping method</strong><br/><span style="color:#5c5c6e;">{{shipping_method}}</span></td></tr>
          </table>
        </td></tr></table>

        <!-- Status Notice -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fef9e7;border-left:4px solid #f59e0b;border-radius:4px;margin-bottom:24px;">
        <tr><td style="padding:16px;font-size:14px;color:#92400e;">
          <strong>⏳ Awaiting Vendor Confirmation</strong><br/>
          Your order has been placed successfully. We'll send you an email once the vendor confirms your order.
        </td></tr></table>$html$,
  updated_at = now()
WHERE template_key = 'order_placed_customer';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Order Update &bull; Being Prepared</p>
<h2 style="margin:0 0 6px;font-size:28px;font-weight:800;color:#1a1a2e;line-height:1.2;">Order Being Prepared 📦</h2>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi <strong style="color:#1a1a2e;">{{customer_name}}</strong>, great news — your order <strong style="color:#1a1a2e;">{{order_number}}</strong> is now being prepared by <strong style="color:#1a1a2e;">{{shop_names}}</strong>. We will notify you once it is ready for shipment.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;"><tr><td style="padding:18px 22px;">
<p style="margin:0 0 12px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:0.8px;">Order Details</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Order Number</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{order_number}}
Order Value</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{customer_currency}} {{customer_total_amount}}
Seller</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{shop_names}}
Status</td><td style="font-size:14px;padding:5px 0;"><span style="background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 100%);color:#fff;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">Processing</span></td></tr>
</table>
</td></tr></table>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:14px;line-height:1.6;">You can track the latest status of your order from your account dashboard at any time.</p>

<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">View Order Status</a>$html$,
  updated_at = now()
WHERE template_key = 'order_processing_customer';

UPDATE public.notification_templates
SET
  email_body_template = $html$<!-- Status Banner -->
      <tr><td style="padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center" style="padding:28px 40px 20px;background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-bottom:3px solid {{order_status_color}};">
        <p style="margin:0;font-size:13px;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1px;">Order Status Changed</p>
        <h2 style="margin:8px 0 0;color:#1a1a2e;font-size:22px;">{{order_status_label}} ✓</h2>
        <p style="margin:6px 0 0;color:hsl(339,82%,46%);font-size:14px;font-weight:700;">ORDER #{{order_number}}</p>
      </td></tr></table></td></tr>

      <!-- Greeting -->
      <tr><td style="padding:28px 40px 8px;"><p style="margin:0;font-size:15px;color:#5c5c6e;">Hi <strong style="color:#1a1a2e;">{{shop_owner_name}}</strong>, here is a status update for one of your orders.</p></td></tr>

      <!-- Order Summary Card -->
      <tr><td style="padding:16px 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border:1px solid hsl(339,20%,88%);border-radius:12px;font-size:14px;">
      <tr><td style="padding:16px 20px;border-bottom:1px solid hsl(339,20%,88%);"><span style="color:#78716c;">Customer</span><br/><strong style="color:#1a1a2e;">{{customer_name}}</strong><span style="color:#78716c;font-size:13px;"> &middot; {{customer_phone}}</span>
<span style="color:#78716c;">Items in your shop ({{item_count}} item(s))</span><br/><span style="color:#1a1a2e;line-height:1.7;">{{items_summary}}</span>
<span style="color:#78716c;">Order Value</span><br/><strong style="color:#1a1a2e;font-size:16px;">{{shop_currency}} {{vendor_order_value}}</strong>
<span style="color:#78716c;">Payment</span><br/><strong style="color:#1a1a2e;">{{payment_status}}</strong>
<span style="color:#78716c;">Shipping address</span><br/><span style="color:#1a1a2e;">{{shipping_address}}</span></td></tr>
      </table></td></tr>

      <!-- Tracking info (only for shipped/out_for_delivery) -->
      {{#if tracking_number}}
      <tr><td style="padding:8px 40px 16px 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-left:4px solid hsl(339,82%,46%);border-radius:4px;font-size:14px;">
      <tr><td style="padding:12px 16px;">
        <strong style="color:hsl(339,82%,46%);">🚚 Tracking Information</strong><br/><br/>
        <span style="color:#1a1a2e;">Tracking #: <strong>{{tracking_number}}</strong></span><br/>
        <span style="color:#1a1a2e;">Carrier: {{carrier_name}}</span><br/>
        <span style="color:#1a1a2e;">Est. Delivery: {{estimated_delivery}}</span>
      </td></tr></table></td></tr>
      {{/if}}

      <!-- Status-specific notice -->
      <tr><td style="padding:8px 40px 24px 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:4px;font-size:14px;">
      <tr><td style="padding:14px 16px;color:#92400e;">{{order_status_vendor_note}}</td></tr></table></td></tr>

      <!-- CTA -->
      <tr><td align="center" style="padding:0 40px 32px 40px;">
      <a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">View Order Details</a>$html$,
  updated_at = now()
WHERE template_key = 'order_status_update_vendor';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:1.5px;">Payment Alert &bull; Action Required</p>
<h2 style="margin:0 0 6px;font-size:28px;font-weight:800;color:#1a1a2e;line-height:1.2;">Payment Failed ❌</h2>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi <strong style="color:#1a1a2e;">{{customer_name}}</strong>, we were unable to process the payment for your order <strong style="color:#1a1a2e;">{{order_number}}</strong>. Please retry using a different payment method.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border-radius:12px;border:1px solid #fecaca;margin-bottom:24px;"><tr><td style="padding:18px 22px;">
<p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.8px;">Payment Details</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Order Number</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{order_number}}
Amount</td><td style="font-size:14px;color:#1a1a2e;font-weight:700;padding:5px 0;">{{customer_currency}} {{customer_payment_amount}}
Failure Reason</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{failure_reason}}
Payment Method</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{payment_method}}
Status</td><td style="font-size:14px;padding:5px 0;"><span style="background:#fee2e2;color:#dc2626;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">Failed</span></td></tr>
</table>
</td></tr></table>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:14px;line-height:1.6;">Your order is reserved but will not be confirmed until payment is successfully processed.</p>

<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(239,68,68,0.40);letter-spacing:0.3px;">Retry Payment</a>$html$,
  updated_at = now()
WHERE template_key = 'payment_failed_customer';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0;font-size:13px;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1px;">Payment Confirmed</p><h2 style="margin:8px 0 0;color:#1a1a2e;font-size:24px;">💰 Payment Received!</h2><p style="margin:6px 0 0;color:hsl(339,82%,46%);font-size:14px;font-weight:700;">ORDER #{{order_number}}</p>
<p style="margin:0;font-size:15px;color:#5c5c6e;">Hi <strong style="color:#1a1a2e;">{{shop_owner_name}}</strong>, great news — payment has been received for the order below. You can now begin processing it.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border:1px solid hsl(339,20%,88%);border-radius:12px;font-size:14px;">
<tr><td style="padding:16px 20px;border-bottom:1px solid hsl(339,20%,88%);"><span style="color:#78716c;">Amount Received (Your Shop)</span><br/><strong style="color:#16a34a;font-size:20px;">{{shop_currency}} {{vendor_payment_amount}}</strong>
<span style="color:#78716c;">Payment Method</span><br/><strong style="color:#1a1a2e;">{{payment_method}}</strong>
<span style="color:#78716c;">Transaction ID</span><br/><span style="color:#1a1a2e;font-family:monospace;">{{transaction_id}}</span>
<span style="color:#78716c;">Customer</span><br/><strong style="color:#1a1a2e;">{{customer_name}}</strong>
<span style="color:#78716c;">Items ({{item_count}} item(s))</span><br/><span style="color:#5c5c6e;line-height:1.7;">{{items_summary}}</span></td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:4px;"><tr><td style="padding:14px 16px;font-size:14px;color:#92400e;"><strong>✅ Action Required:</strong> Please begin preparing and packing this order for dispatch.</td></tr></table>
<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">Process Order</a>$html$,
  updated_at = now()
WHERE template_key = 'payment_received_vendor';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Community &bull; New Comment</p>
<h2 style="margin:0 0 10px;font-size:26px;font-weight:800;color:#1a1a2e;line-height:1.3;">Someone commented on your post 💬</h2>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;"><strong style="color:#1a1a2e;">{{commenter_name}}</strong> left a comment on your post.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:16px;"><tr><td style="padding:18px 22px;">
<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:0.8px;">Their Comment</p>
<p style="margin:0;font-size:14px;color:#1a1a2e;line-height:1.7;font-style:italic;">"{{comment_preview}}"</p>
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;margin-bottom:24px;"><tr><td style="padding:18px 22px;">
<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#5c5c6e;text-transform:uppercase;letter-spacing:0.8px;">Your Post</p>
<p style="margin:0;font-size:14px;color:#1a1a2e;line-height:1.7;font-style:italic;">"{{post_preview}}"</p>
</td></tr></table>

<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">View Comment</a>$html$,
  updated_at = now()
WHERE template_key = 'post_comment';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:1.5px;">Community &bull; New Comment</p>
<h2 style="margin:0 0 10px;font-size:26px;font-weight:800;color:#111827;line-height:1.3;">Someone commented on your post 💬</h2>
<p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.7;"><strong style="color:#111827;">{{commenter_name}}</strong> left a comment on your post.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf5ff;border-radius:12px;border:1px solid #ede9fe;margin-bottom:16px;"><tr><td style="padding:18px 22px;">
<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6d28d9;text-transform:uppercase;letter-spacing:0.8px;">Their Comment</p>
<p style="margin:0;font-size:14px;color:#374151;line-height:1.7;font-style:italic;">"{{comment_preview}}"</p>
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;margin-bottom:24px;"><tr><td style="padding:18px 22px;">
<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.8px;">Your Post</p>
<p style="margin:0;font-size:14px;color:#374151;line-height:1.7;font-style:italic;">"{{post_preview}}"</p>
</td></tr></table>

<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed 0%,#ec4899 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(124,58,237,0.35);letter-spacing:0.3px;">View Comment</a>$html$,
  updated_at = now()
WHERE template_key = 'post_commented';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Community &bull; Post Reaction</p>
<h2 style="margin:0 0 10px;font-size:26px;font-weight:800;color:#1a1a2e;line-height:1.3;">Someone reacted to your post! 👍</h2>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;"><strong style="color:#1a1a2e;">{{reactor_name}}</strong> reacted with <strong style="color:hsl(339,82%,46%);">{{reaction_type}}</strong> to your post on SHEconomy Community.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;"><tr><td style="padding:18px 22px;">
<p style="margin:0 0 12px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:0.8px;">Post Preview</p>
<p style="margin:0;font-size:14px;color:#1a1a2e;line-height:1.7;font-style:italic;">"{{post_preview}}"</p>
</td></tr></table>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:14px;line-height:1.6;">Visit your post to see all reactions and engage with your community.</p>

<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">View Post</a>$html$,
  updated_at = now()
WHERE template_key = 'post_liked';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Community &bull; You Were Mentioned</p>
<h2 style="margin:0 0 10px;font-size:26px;font-weight:800;color:#1a1a2e;line-height:1.3;">You were mentioned in a post 📣</h2>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;"><strong style="color:#1a1a2e;">{{mentioner_name}}</strong> mentioned you in their post on SHEconomy Community.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;"><tr><td style="padding:18px 22px;">
<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:0.8px;">Their Post</p>
<p style="margin:0;font-size:14px;color:#1a1a2e;line-height:1.7;font-style:italic;">"{{post_preview}}"</p>
</td></tr></table>

<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">View Post</a>$html$,
  updated_at = now()
WHERE template_key = 'post_mentioned';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Community &bull; Reply to Comment</p>
<h2 style="margin:0 0 10px;font-size:26px;font-weight:800;color:#1a1a2e;line-height:1.3;">Someone replied to your comment ↩️</h2>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;"><strong style="color:#1a1a2e;">{{replier_name}}</strong> replied to your comment on SHEconomy.</p>

<!-- Reply preview card with warm gradient -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:16px;">
<tr><td style="padding:18px 22px;">
<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:0.8px;">Their Reply</p>
<p style="margin:0;font-size:14px;color:#1a1a2e;line-height:1.7;font-style:italic;">"{{reply_preview}}"</p>
</td></tr></table>

<!-- Your comment card -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;margin-bottom:24px;">
<tr><td style="padding:18px 22px;">
<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#5c5c6e;text-transform:uppercase;letter-spacing:0.8px;">Your Comment</p>
<p style="margin:0;font-size:14px;color:#1a1a2e;line-height:1.7;font-style:italic;">"{{original_comment_preview}}"</p>
</td></tr></table>



<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">View Reply</a>
</td></tr>

<!-- Footer with warm gradient -->$html$,
  updated_at = now()
WHERE template_key = 'post_reply';

UPDATE public.notification_templates
SET
  email_body_template = $html$<!-- Warning banner - kept warm orange for alert visibility -->
  <tr><td style="background:#fff7ed;border-bottom:1px solid #fed7aa;padding:14px 40px;text-align:center;">
    <p style="margin:0;font-size:13px;color:#9a3412;font-weight:600;">
      ⚠️&nbsp; Your account may be <strong>deactivated</strong> if your profile remains incomplete.
    </p>
  

    <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">
      Action Required &bull; Your Profile
    </p>
    <h2 style="margin:0 0 10px;font-size:28px;font-weight:800;color:#1a1a2e;line-height:1.2;">
      👤 Complete your profile
    </h2>
    <p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;">
      Hi <strong style="color:#1a1a2e;">{{full_name}}</strong>,<br><br>
      Thank you for being part of <strong style="color:hsl(339,82%,46%);">SHEconomy</strong> — India's marketplace
      for women-led businesses. Your profile is currently
      <strong style="color:#1a1a2e;">{{profile_completion_percentage}}% complete</strong>.<br><br>
      To keep your account <strong style="color:#1a1a2e;">active and trusted</strong> on our platform,
      please fill in the missing details listed below.
      Incomplete profiles may be <strong style="color:#dc2626;">deactivated</strong> within 7 days.
    </p>

    <!-- Missing Info card with warm gradient -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:20px;">
      <tr><td style="padding:18px 22px;">
        <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:0.8px;">
          Missing Information
        </p>
        <p style="margin:0;font-size:14px;color:#1a1a2e;line-height:1.8;">{{missing_fields_html}}</p>
      </td></tr>
    </table>

    <!-- Tip card with warm gradient -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;">
      <tr><td style="padding:14px 22px;">
        <p style="margin:0;font-size:13px;color:#1a1a2e;line-height:1.6;">
          <strong style="color:hsl(339,82%,46%);">💡 Tip:</strong> {{profile_tip}}
        </p>
      </td></tr>
    </table>
  

    <a href="{{action_url}}"
       style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);
              color:#fff;font-weight:700;font-size:15px;text-decoration:none;
              padding:14px 40px;border-radius:50px;
              box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">
      Complete My Profile
    </a>
    <p style="margin:16px 0 0;color:#9ca3af;font-size:12px;">
      Takes less than 2 minutes &bull; Keeps your account active
    </p>
  </td></tr>

  <!-- Footer with warm gradient -->$html$,
  updated_at = now()
WHERE template_key = 'profile_incomplete';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Refund Confirmed &bull; Amount Credited</p>
<h2 style="margin:0 0 6px;font-size:28px;font-weight:800;color:#1a1a2e;line-height:1.2;">Refund Processed ✅</h2>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi <strong style="color:#1a1a2e;">{{customer_name}}</strong>, your refund of <strong style="color:hsl(339,82%,46%);">{{customer_currency}} {{customer_refund_amount}}</strong> for order <strong style="color:#1a1a2e;">{{order_number}}</strong> has been processed successfully.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;"><tr><td style="padding:18px 22px;">
<p style="margin:0 0 12px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:0.8px;">Refund Details</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Order Number</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{order_number}}
Refund Amount</td><td style="font-size:14px;color:hsl(339,82%,46%);font-weight:700;padding:5px 0;">{{customer_currency}} {{customer_refund_amount}}
Refund Method</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{refund_method}}
Processing Time</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{processing_time}}
Status</td><td style="font-size:14px;padding:5px 0;"><span style="background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 100%);color:#fff;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">Processed ✅</span></td></tr>
</table></td></tr></table>

<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">View Order Details</a>$html$,
  updated_at = now()
WHERE template_key = 'refund_processed_customer';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">New Event &bull; Join Now</p><h2 style="margin:0 0 10px;font-size:30px;font-weight:800;color:#1a1a2e;line-height:1.2;">🎉 "{{event_name}}" is Live!</h2><p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi <strong style="color:#1a1a2e;">{{vendor_name}}</strong>, a new sale event has just launched on SHEconomy! Enroll your shop <strong style="color:#1a1a2e;">{{shop_name}}</strong> to participate and boost your visibility during the event.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;"><tr><td style="padding:18px 22px;"><p style="margin:0 0 12px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:0.8px;">Event Details</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Event</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{event_name}}
Starts</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{start_date}}
Ends</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{end_date}}
Currency</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{currency}}
Registration Opens</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{registration_start_date}}
Enroll By</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{registration_end_date}}</td></tr></table></td></tr></table>
<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">View & Enroll</a>$html$,
  updated_at = now()
WHERE template_key = 'sale_event_announcement';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Admin Action Needed &bull; Enrollment Request</p><h2 style="margin:0 0 16px;font-size:26px;font-weight:800;color:#1a1a2e;line-height:1.2;">{{shop_name}} wants to join!</h2><p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;"><strong style="color:#1a1a2e;">{{vendor_name}}</strong> from <strong style="color:#1a1a2e;">{{shop_name}}</strong> has submitted an enrollment request for your sale event. Please review and take action.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;"><tr><td style="padding:18px 22px;"><p style="margin:0 0 12px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:0.8px;">Request Details</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Event</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{event_name}}
Shop</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{shop_name}}
Vendor</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{vendor_name}}
Currency</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{currency}}
Enroll By</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{registration_end_date}}</td></tr></table></td></tr></table>
<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">Review Application</a>$html$,
  updated_at = now()
WHERE template_key = 'sale_event_enrollment_request';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Enrollment Update &bull; Vendor Withdrew</p><h2 style="margin:0 0 16px;font-size:26px;font-weight:800;color:#1a1a2e;line-height:1.2;">{{shop_name}} has withdrawn ↩️</h2><p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;"><strong style="color:#1a1a2e;">{{vendor_name}}</strong> from <strong style="color:#1a1a2e;">{{shop_name}}</strong> has withdrawn their enrollment request from this sale event. No action is required.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;"><tr><td style="padding:18px 22px;"><p style="margin:0 0 12px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:0.8px;">Event Details</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Event</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{event_name}}
Shop</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{shop_name}}
Vendor</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{vendor_name}}
Currency</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{currency}}</td></tr></table></td></tr></table>
<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">View Event</a>$html$,
  updated_at = now()
WHERE template_key = 'sale_event_enrollment_withdrawn';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Event Ended &bull; Thank You</p><h2 style="margin:0 0 16px;font-size:26px;font-weight:800;color:#1a1a2e;line-height:1.2;">"{{event_name}}" has wrapped up 🏁</h2><p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi <strong style="color:#1a1a2e;">{{vendor_name}}</strong>, thank you for participating in this sale event with <strong style="color:#1a1a2e;">{{shop_name}}</strong>! All event discounts have been deactivated automatically.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;"><tr><td style="padding:18px 22px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Event</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{event_name}}
Your Shop</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{shop_name}}
Currency</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{currency}}
Status</td><td style="font-size:14px;padding:5px 0;"><span style="background:hsl(339,20%,88%);color:hsl(339,82%,46%);padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">Ended</span></td></tr></table></td></tr></table>
<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">Browse Events</a>$html$,
  updated_at = now()
WHERE template_key = 'sale_event_now_expired';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Event Alert &bull; Now Live</p>
<h2 style="margin:0 0 10px;font-size:30px;font-weight:800;color:#1a1a2e;line-height:1.2;">"{{event_name}}" is LIVE! 🚀</h2>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi <strong style="color:#1a1a2e;">{{vendor_name}}</strong>, the sale event is now active and your shop <strong style="color:#1a1a2e;">{{shop_name}}</strong> is live and visible to customers. Make sure your discounted offers are set up!</p>

<!-- Event Info card with warm gradient -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;">
<tr><td style="padding:18px 22px;">
<p style="margin:0 0 12px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:0.8px;">Event Info</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Event</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{event_name}}
Your Shop</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{shop_name}}
Event Ends</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{end_date}}
Currency</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{currency}}
Status</td><td style="font-size:14px;padding:5px 0;">
<span style="background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 100%);color:#fff;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">Live Now</span>
</td></tr>
</table>
</td></tr></table>



<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">View My Enrollments</a>
</td></tr>

<!-- Footer with warm gradient -->$html$,
  updated_at = now()
WHERE template_key = 'sale_event_now_live';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">New Offer Available &bull; Action May Be Needed</p>
<h2 style="margin:0 0 16px;font-size:26px;font-weight:800;color:#1a1a2e;line-height:1.2;">New deal added to "{{event_name}}"! 🎁</h2>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi <strong style="color:#1a1a2e;">{{vendor_name}}</strong>, a new offer has just been created for the sale event your shop <strong style="color:#1a1a2e;">{{shop_name}}</strong> is enrolled in. <strong style="color:hsl(339,82%,46%);">You may need to attach your products to this offer</strong> to participate in the discount.</p>

<!-- Offer Details card with warm gradient -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:16px;">
<tr><td style="padding:18px 22px;">
<p style="margin:0 0 12px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:0.8px;">Offer Details</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Offer Name</td><td style="font-size:14px;color:#1a1a2e;font-weight:700;padding:5px 0;">{{offer_name}}
Discount</td><td style="font-size:14px;padding:5px 0;">
<span style="background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 100%);color:#fff;padding:3px 12px;border-radius:20px;font-size:13px;font-weight:700;">{{discount_label}}</span>

Applies To</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;text-transform:capitalize;">{{applies_to}}
Event</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{event_name}}
Currency</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{currency}}
Event Dates</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{start_date}} &rarr; {{end_date}}</td></tr>
</table>
</td></tr></table>

<p style="margin:0 0 24px;color:#5c5c6e;font-size:14px;line-height:1.6;">Log in to your enrollments dashboard to review this offer and attach the relevant products or categories from your shop.</p>


<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">View My Enrollments</a>
</td></tr>

<!-- Footer with warm gradient -->$html$,
  updated_at = now()
WHERE template_key = 'sale_event_offer_created';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Action Required &bull; Shop Profile</p>
<h2 style="margin:0 0 10px;font-size:28px;font-weight:800;color:#1a1a2e;line-height:1.2;">✏️ Complete your shop profile</h2>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi <strong style="color:#1a1a2e;">{{vendor_name}}</strong>, your shop <strong style="color:#1a1a2e;">{{shop_name}}</strong> is looking great — but a few details are still missing. Completing your profile helps customers trust your shop and improves your search ranking on SHEconomy.</p>

<!-- Missing info card with warm gradient -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;">
<tr><td style="padding:18px 22px;">
<p style="margin:0 0 12px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:0.8px;">Missing Information</p>
<p style="margin:0;font-size:14px;color:#1a1a2e;line-height:1.8;">{{missing_fields_html}}</p>
</td></tr></table>

<p style="margin:0 0 24px;color:#5c5c6e;font-size:14px;line-height:1.6;">Shops with complete profiles get up to <strong style="color:#1a1a2e;">3x more visibility</strong> in search results and earn greater trust from buyers.</p>


<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">Complete My Shop Profile</a>
</td></tr>

<!-- Footer with warm gradient -->$html$,
  updated_at = now()
WHERE template_key = 'shop_profile_incomplete';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:1.5px;">Shop Update &bull; Verification Revoked</p><h2 style="margin:0 0 10px;font-size:28px;font-weight:800;color:#1a1a2e;line-height:1.2;">Shop Verification Revoked ⚠️</h2><p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi <strong style="color:#1a1a2e;">{{owner_name}}</strong>, the verification for your shop <strong style="color:#1a1a2e;">{{shop_name}}</strong> has been <strong style="color:#dc2626;">revoked</strong>.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border-radius:12px;border:1px solid #fecaca;margin-bottom:24px;"><tr><td style="padding:18px 22px;"><p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.8px;">Revocation Details</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Shop</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{shop_name}}
Reason</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{revocation_reason}}
Status</td><td style="font-size:14px;padding:5px 0;"><span style="background:#fee2e2;color:#dc2626;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">Revoked</span></td></tr></table></td></tr></table>
<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(239,68,68,0.40);letter-spacing:0.3px;">Contact Support</a>$html$,
  updated_at = now()
WHERE template_key = 'shop_verification_revoked';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Shop Update &bull; Verification Approved</p><h2 style="margin:0 0 10px;font-size:30px;font-weight:800;color:#1a1a2e;line-height:1.2;">Your shop is verified! 🎉</h2><p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;">Congratulations <strong style="color:#1a1a2e;">{{owner_name}}</strong>! Your shop <strong style="color:#1a1a2e;">{{shop_name}}</strong> has been successfully verified and is now live on SHEconomy. Customers can now discover and purchase from your shop.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;"><tr><td style="padding:18px 22px;"><p style="margin:0 0 12px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:0.8px;">Shop Details</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Shop Name</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{shop_name}}
Owner</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{owner_name}}
Verified On</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{verification_date}}
Status</td><td style="font-size:14px;padding:5px 0;"><span style="background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 100%);color:#fff;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">Verified ✅</span></td></tr></table></td></tr></table>
<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">Start Selling</a>$html$,
  updated_at = now()
WHERE template_key = 'shop_verified';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:1.5px;">Great News &bull; Enrollment Confirmed</p>
<h2 style="margin:0 0 6px;font-size:30px;font-weight:800;color:#1a1a2e;line-height:1.2;">You're in, {{vendor_name}}! ✅</h2>
<p style="margin:0 0 24px;color:#5c5c6e;font-size:15px;line-height:1.7;">Your shop <strong style="color:#1a1a2e;">{{shop_name}}</strong> has been <strong style="color:hsl(339,82%,46%);">accepted</strong> to participate in the sale event <strong style="color:#1a1a2e;">{{event_name}}</strong>. Customers will see your discounted offers during the event period.</p>

<!-- Event Details card with warm gradient -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, hsl(30,50%,98%) 0%, hsl(339,30%,95%) 50%, hsl(30,50%,98%) 100%);border-radius:12px;border:1px solid hsl(339,20%,88%);margin-bottom:24px;">
<tr><td style="padding:18px 22px;">
<p style="margin:0 0 12px;font-size:11px;font-weight:700;color:hsl(339,82%,46%);text-transform:uppercase;letter-spacing:0.8px;">Event Details</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Event</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{event_name}}
Starts</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{start_date}}
Ends</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{end_date}}
Currency</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{currency}}
Status</td><td style="font-size:14px;padding:5px 0;">
<span style="background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 100%);color:#fff;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">Accepted</span>
</td></tr>
</table>
</td></tr></table>

<p style="margin:0 0 24px;color:#5c5c6e;font-size:14px;line-height:1.6;">Head to your enrollments dashboard to review the event offers and set up discounts for your listings.</p>


<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">View My Enrollments</a>
</td></tr>

<!-- Footer with warm gradient -->$html$,
  updated_at = now()
WHERE template_key = 'vendor_enrollment_accepted';

UPDATE public.notification_templates
SET
  email_body_template = $html$<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:1.5px;">Enrollment Update</p><h2 style="margin:0 0 16px;font-size:26px;font-weight:800;color:#1a1a2e;line-height:1.2;">Enrollment Not Approved</h2><p style="margin:0 0 20px;color:#5c5c6e;font-size:15px;line-height:1.7;">Hi <strong style="color:#1a1a2e;">{{vendor_name}}</strong>, we're sorry — your shop <strong style="color:#1a1a2e;">{{shop_name}}</strong> was not approved for the sale event <strong style="color:#1a1a2e;">{{event_name}}</strong> at this time.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border-radius:12px;border:1px solid #fecaca;margin-bottom:24px;"><tr><td style="padding:18px 22px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:13px;color:#78716c;padding:5px 0;width:38%;">Event</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{event_name}}
Shop</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{shop_name}}
Currency</td><td style="font-size:14px;color:#1a1a2e;font-weight:600;padding:5px 0;">{{currency}}
Status</td><td style="font-size:14px;padding:5px 0;"><span style="background:#fee2e2;color:#dc2626;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;">Not Approved</span></td></tr></table></td></tr></table><p style="margin:0 0 24px;color:#5c5c6e;font-size:14px;line-height:1.6;">Don't be discouraged! Browse other active events on SHEconomy and apply again for future opportunities.</p>
<a href="{{action_url}}" style="display:inline-block;background:linear-gradient(135deg, hsl(339,82%,46%) 0%, hsl(339,90%,45%) 50%, hsl(35,100%,50%) 100%);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 40px;border-radius:50px;box-shadow:0 4px 14px rgba(200,40,80,0.40);letter-spacing:0.3px;">Browse Sale Events</a>$html$,
  updated_at = now()
WHERE template_key = 'vendor_enrollment_rejected';
