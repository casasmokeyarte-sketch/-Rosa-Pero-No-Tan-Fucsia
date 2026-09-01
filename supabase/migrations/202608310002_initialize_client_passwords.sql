-- Los clientes importados sin contraseña nunca recibieron la clave temporal
-- anunciada por la interfaz. El trigger existente genera password_hash.
update public.clients
set password = '1234',
    password_hash = extensions.crypt('1234', extensions.gen_salt('bf', 10))
where password_hash is null
  and (password is null or btrim(password) = '');
