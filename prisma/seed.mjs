import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function parseRounds(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 4) {
    return 10;
  }
  return Math.floor(parsed);
}

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL ?? 'admin@jptecidos.com')
    .toLowerCase()
    .trim();
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'Admin@123456';
  const adminName = (process.env.ADMIN_NAME ?? 'Administrador')
    .trim();
  const rounds = parseRounds(process.env.BCRYPT_ROUNDS);

  if (adminPassword.length < 6) {
    throw new Error('ADMIN_PASSWORD precisa ter no minimo 6 caracteres.');
  }

  const senhaHash = await bcrypt.hash(adminPassword, rounds);

  const admin = await prisma.usuario.upsert({
    where: { email: adminEmail },
    update: {
      nome: adminName,
      senha: senhaHash,
      ehAdmin: true,
    },
    create: {
      email: adminEmail,
      nome: adminName,
      senha: senhaHash,
      ehAdmin: true,
    },
    select: {
      id: true,
      email: true,
      nome: true,
      ehAdmin: true,
    },
  });

  console.log('Admin seed concluido:', {
    id: admin.id,
    email: admin.email,
    nome: admin.nome,
    ehAdmin: admin.ehAdmin,
  });
}

main()
  .catch((error) => {
    console.error('Falha ao executar seed de admin.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
