#!/bin/bash

# =====================================================
# HireBuddy Referral System Setup Script
# =====================================================
# This script helps you set up the referral system
# =====================================================

echo "🎯 HireBuddy Referral System Setup"
echo "=================================="
echo ""

# Check if we're in the right directory
if [ ! -f "00_referral_setup_master.sql" ]; then
    echo "❌ Error: Please run this script from the directory containing the SQL files"
    echo "   Current directory: $(pwd)"
    echo "   Expected files: 00_referral_setup_master.sql, 01_referral_tables.sql, etc."
    exit 1
fi

echo "✅ Found referral system SQL files"
echo ""

# Show available options
echo "Choose your setup method:"
echo "1. 🚀 Quick Setup (Recommended) - Run master file only"
echo "2. 📋 Step-by-Step Setup - Run files individually"
echo "3. 🔍 Verify Setup - Check if system is working"
echo "4. 📚 Show Documentation"
echo "5. 🚪 Exit"
echo ""

read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        echo ""
        echo "🚀 Quick Setup Selected"
        echo "========================="
        echo ""
        echo "This will run the master setup file which creates everything at once."
        echo ""
        read -p "Are you sure? (y/N): " confirm
        if [[ $confirm =~ ^[Yy]$ ]]; then
            echo ""
            echo "📋 Instructions for Quick Setup:"
            echo "1. Open your Supabase database SQL editor"
            echo "2. Copy the contents of '00_referral_setup_master.sql'"
            echo "3. Paste and run the SQL in Supabase"
            echo "4. Check the output for success messages"
            echo ""
            echo "📁 File to use: 00_referral_setup_master.sql"
            echo ""
            echo "✅ Setup complete! Your referral system is ready."
        else
            echo "Setup cancelled."
        fi
        ;;
    2)
        echo ""
        echo "📋 Step-by-Step Setup Selected"
        echo "=============================="
        echo ""
        echo "Run these files in order in your Supabase database:"
        echo ""
        echo "1. 01_referral_tables.sql      - Creates tables and indexes"
        echo "2. 02_referral_functions.sql   - Creates helper functions"
        echo "3. 03_referral_triggers.sql    - Sets up triggers and RLS"
        echo "4. 04_referral_views.sql       - Creates admin views"
        echo "5. 05_referral_verification.sql - Verifies setup"
        echo ""
        echo "📝 Instructions:"
        echo "- Open each file in order"
        echo "- Copy the SQL content"
        echo "- Paste and run in Supabase SQL editor"
        echo "- Wait for each file to complete before running the next"
        echo ""
        ;;
    3)
        echo ""
        echo "🔍 Verification Setup Selected"
        echo "=============================="
        echo ""
        echo "To verify your setup is working:"
        echo ""
        echo "1. Run the verification queries from 05_referral_verification.sql"
        echo "2. Check that all tables exist and RLS is enabled"
        echo "3. Verify functions and triggers are working"
        echo "4. Test with sample data if needed"
        echo ""
        echo "📊 Expected Results:"
        echo "- 3 tables created: user_referral_codes, referrals, referral_rewards"
        echo "- 15 RLS policies active"
        echo "- 7 helper functions working"
        echo "- 1 trigger active"
        echo "- 3 admin views accessible"
        echo ""
        ;;
    4)
        echo ""
        echo "📚 Documentation"
        echo "================"
        echo ""
        echo "📖 README: REFERRAL_SYSTEM_README.md"
        echo "   - Complete setup guide"
        echo "   - API integration examples"
        echo "   - Troubleshooting tips"
        echo ""
        echo "🗄️ Database Schema:"
        echo "   - user_referral_codes: Store referral codes"
        echo "   - referrals: Track referral relationships"
        echo "   - referral_rewards: Track progress and premium"
        echo ""
        echo "🔒 Security Features:"
        echo "   - Row Level Security (RLS) enabled"
        echo "   - Anti-fraud measures"
        echo "   - Automatic validation"
        echo ""
        echo "📊 Admin Views:"
        echo "   - admin_referral_summary: User overview"
        echo "   - referral_statistics: System stats"
        echo "   - user_referral_progress: Progress tracking"
        echo ""
        ;;
    5)
        echo "Goodbye! 👋"
        exit 0
        ;;
    *)
        echo "❌ Invalid choice. Please select 1-5."
        exit 1
        ;;
esac

echo ""
echo "=================================="
echo "🎯 Referral System Setup Complete!"
echo "=================================="
echo ""
echo "Next steps:"
echo "1. Run the SQL files in your Supabase database"
echo "2. Test the system with real user data"
echo "3. Integrate with your frontend application"
echo "4. Set up monitoring and alerts"
echo ""
echo "📚 For detailed instructions, see: REFERRAL_SYSTEM_README.md"
echo ""
echo "Happy referring! 🚀"

