const express = require('express');
const axios = require('axios');
const app = express();
const port = 3000;

// Lista de monitores en memoria
let monitors = [];

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Contenido HTML
const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Monitor de Sitios Web</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 font-sans">
  <div class="container mx-auto p-6">
    <h1 class="text-3xl font-bold text-center mb-6">Monitor de Sitios Web</h1>
    
    <!-- Formulario para agregar URLs -->
    <div class="bg-white p-6 rounded-lg shadow-md mb-6">
      <h2 class="text-xl font-semibold mb-4">Agregar Sitio Web</h2>
      <form id="monitorForm" class="space-y-4">
        <div>
          <label for="url" class="block text-sm font-medium text-gray-700">URL del sitio</label>
          <input type="url" id="url" name="url" placeholder="https://ejemplo.com" required
                 class="mt-1 block w-full border border-gray-300 rounded-md p-2">
        </div>
        <div>
          <label for="interval" class="block text-sm font-medium text-gray-700">Intervalo (segundos)</label>
          <input type="number" id="interval" name="interval" min="10" value="60" required
                 class="mt-1 block w-full border border-gray-300 rounded-md p-2">
        </div>
        <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
          Agregar
        </button>
      </form>
    </div>

    <!-- Tabla de estado -->
    <div class="bg-white p-6 rounded-lg shadow-md">
      <h2 class="text-xl font-semibold mb-4">Estado de los Sitios</h2>
      <table class="w-full text-left">
        <thead>
          <tr class="bg-gray-200">
            <th class="p-3">URL</th>
            <th class="p-3">Estado</th>
            <th class="p-3">Última Verificación</th>
            <th class="p-3">Mensaje</th>
            <th class="p-3">Acciones</th>
          </tr>
        </thead>
        <tbody id="statusTable"></tbody>
      </table>
    </div>
  </div>

  <script>
    // Función para agregar un sitio al enviar el formulario
    document.getElementById('monitorForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = document.getElementById('url').value;
      const interval = document.getElementById('interval').value;

      try {
        const response = await fetch('/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, interval: parseInt(interval) })
        });
        if (response.ok) {
          alert('Sitio agregado correctamente');
          document.getElementById('monitorForm').reset();
          fetchStatus();
        } else {
          alert('Error al agregar el sitio');
        }
      } catch (error) {
        alert('Error: ' + error.message);
      }
    });

    // Función para actualizar la tabla de estado
    async function fetchStatus() {
      try {
        const response = await fetch('/status');
        const monitors = await response.json();
        const tableBody = document.getElementById('statusTable');
        tableBody.innerHTML = '';

        monitors.forEach(monitor => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td class="p-3">\${monitor.url}</td>
            <td class="p-3">
              <span class="inline-block px-2 py-1 rounded-full text-sm 
                \${monitor.status === 'Activo' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}">
                \${monitor.status}
              </span>
            </td>
            <td class="p-3">\${monitor.lastCheck ? new Date(monitor.lastCheck).toLocaleString('es-ES') : '-'}</td>
            <td class="p-3">\${monitor.message || '-'}</td>
            <td class="p-3">
              <button onclick="deleteMonitor('\${monitor.url}')"
                      class="bg-red-600 text-white px-2 py-1 rounded-md hover:bg-red-700">
                Eliminar
              </button>
            </td>
          `;
          tableBody.appendChild(row);
        });
      } catch (error) {
        console.error('Error al obtener el estado:', error);
      }
    }

    // Función para eliminar un monitor
    async function deleteMonitor(url) {
      if (confirm(\`¿Eliminar el monitor para \${url}?\`)) {
        try {
          const response = await fetch('/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
          });
          if (response.ok) {
            alert('Sitio eliminado correctamente');
            fetchStatus();
          } else {
            alert('Error al eliminar el sitio');
          }
        } catch (error) {
          alert('Error: ' + error.message);
        }
      }
    }

    // Actualizar la tabla cada 5 segundos
    setInterval(fetchStatus, 5000);
    fetchStatus(); // Cargar inicialmente
  </script>
</body>
</html>
`;

// Ruta para servir la página principal
app.get('/', (req, res) => {
  res.send(htmlContent);
});

// Ruta para agregar un nuevo monitor
app.post('/add', (req, res) => {
  const { url, interval } = req.body;
  if (!url || !interval || interval < 10) {
    return res.status(400).json({ error: 'URL o intervalo inválido' });
  }

  // Verificar si la URL ya existe
  if (monitors.find(m => m.url === url)) {
    return res.status(400).json({ error: 'La URL ya está siendo monitoreada' });
  }

  const monitor = {
    url,
    interval: interval * 1000, // Convertir a milisegundos
    status: 'Desconocido',
    lastCheck: null,
    message: null
  };
  monitors.push(monitor);
  startMonitoring(monitor);
  res.json({ success: true });
});

// Ruta para obtener el estado de todos los monitores
app.get('/status', (req, res) => {
  res.json(monitors);
});

// Ruta para eliminar un monitor
app.post('/delete', (req, res) => {
  const { url } = req.body;
  monitors = monitors.filter(m => m.url !== url);
  res.json({ success: true });
});

// Función para monitorear una URL
function startMonitoring(monitor) {
  const checkSite = async () => {
    try {
      const response = await axios.get(monitor.url, { timeout: 5000 });
      monitor.status = response.status === 200 ? 'Activo' : 'Caído';
      monitor.message = response.status === 200 ? null : `Código: ${response.status}`;
    } catch (error) {
      monitor.status = 'Caído';
      monitor.message = error.message;
    }
    monitor.lastCheck = new Date();
  };

  // Verificar inmediatamente y luego cada intervalo
  checkSite();
  setInterval(checkSite, monitor.interval);
}

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
