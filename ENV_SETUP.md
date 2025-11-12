# Environment Variables Setup Guide

This guide explains the required environment variables for the authentication system to work properly.

## Critical Environment Variables

### 1. NEXTAUTH_SECRET (Required)

This is a secret key used to encrypt JWT tokens and session data. It must be set for NextAuth to function.

**Generate a secure secret:**

```bash
# On Linux/Mac:
openssl rand -base64 32

# Or use Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# On Windows PowerShell:
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

**Add to your `.env` or `.env.local`:**

```env
NEXTAUTH_SECRET=your_generated_secret_here
```

### 2. NEXTAUTH_URL (Required for Development)

This should be set to your application URL. In development, this is typically:

```env
NEXTAUTH_URL=http://localhost:3000
```

In production (Vercel), this is usually auto-detected, but you can set it explicitly:

```env
NEXTAUTH_URL=https://yourdomain.com
```

### 3. DATABASE_URL (Required)

Your database connection string. The format depends on your database provider.

**PostgreSQL example:**

```env
DATABASE_URL="postgresql://username:password@localhost:5432/database_name"
```

**For Supabase:**

```env
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
```

### 4. Node Environment

```env
NODE_ENV=development  # or 'production'
```

## Complete .env Example

Create a `.env` or `.env.local` file in your project root with:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/database_name"

# NextAuth
NEXTAUTH_SECRET="your_32_character_or_longer_secret_key_here"
NEXTAUTH_URL="http://localhost:3000"

# Node Environment
NODE_ENV="development"
```

## Verifying Your Setup

1. **Check if all required variables are set:**

```bash
# On Linux/Mac:
grep -E 'NEXTAUTH_SECRET|NEXTAUTH_URL|DATABASE_URL' .env

# On Windows PowerShell:
Select-String -Path .env -Pattern 'NEXTAUTH_SECRET|NEXTAUTH_URL|DATABASE_URL'
```

2. **Test database connection:**

```bash
npx prisma db pull
```

3. **Restart your development server:**

```bash
npm run dev
```

## Common Issues

### "Failed to fetch" error

**Cause:** Missing `NEXTAUTH_SECRET` or `NEXTAUTH_URL`

**Solution:** Ensure both variables are set in your `.env` file and restart your dev server.

### Database connection errors

**Cause:** Incorrect `DATABASE_URL` or database not running

**Solution:** 
- Verify your database is running
- Check the connection string format
- Test connection with `npx prisma db pull`

### Authentication loops

**Cause:** Incorrect cookie configuration or missing secret

**Solution:**
- Ensure `NEXTAUTH_SECRET` is set and matches across deployments
- Clear browser cookies and try again
- Check that `trustHost: true` is set in auth config (already configured)

## Security Notes

- **Never commit `.env` files to version control**
- Use different secrets for development and production
- Rotate your `NEXTAUTH_SECRET` periodically in production
- Use environment variables in your deployment platform (Vercel, etc.)

## Next Steps

After setting up your environment variables:

1. Run database migrations: `npx prisma migrate dev`
2. Restart your dev server: `npm run dev`
3. Try logging in again
4. Check the console for any error messages

