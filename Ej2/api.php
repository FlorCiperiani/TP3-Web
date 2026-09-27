<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$archivo = __DIR__ . DIRECTORY_SEPARATOR . 'recursos' . DIRECTORY_SEPARATOR . 'turnero.json';
$accion = $_GET['accion'] ?? '';
$entrada = json_decode(file_get_contents('php://input'), true) ?? [];

function responder(bool $ok, string $mensaje = '', ?array $datos = null, int $codigo = 200): never
{
    http_response_code($codigo);
    echo json_encode([
        'ok' => $ok,
        'mensaje' => $mensaje,
        'datos' => $datos
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

function validarLimites(mixed $inferior, mixed $superior): bool
{
    return is_int($inferior)
        && is_int($superior)
        && $inferior >= 0
        && $superior >= $inferior;
}

function leerEstado(string $archivo): array
{
    if (!is_file($archivo)) {
        throw new RuntimeException('No existe el archivo de datos.');
    }
    $datos = json_decode((string) file_get_contents($archivo), true);
    if (!is_array($datos) || !isset($datos['limite inferior'], $datos['limite superior'], $datos['números'])) {
        throw new RuntimeException('El archivo de datos no tiene un formato válido.');
    }
    return $datos;
}

function guardarEstado(string $archivo, array $datos): void
{
    $contenido = json_encode($datos, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    if ($contenido === false || file_put_contents($archivo, $contenido, LOCK_EX) === false) {
        throw new RuntimeException('No se pudo guardar el archivo de datos.');
    }
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        responder(false, 'Método no permitido.', null, 405);
    }

    $estado = leerEstado($archivo);

    if ($accion === 'cargar') {
        responder(true, '', $estado);
    }

    if ($accion === 'guardar') {
        $inferior = $entrada['limite inferior'] ?? null;
        $superior = $entrada['limite superior'] ?? null;
        $numeros = $entrada['números'] ?? [];
        if (!validarLimites($inferior, $superior) || !is_array($numeros)) {
            responder(false, 'Los datos recibidos no son válidos.', null, 422);
        }
        guardarEstado($archivo, [
            'limite inferior' => $inferior,
            'limite superior' => $superior,
            'números' => array_values($numeros)
        ]);
        responder(true, 'Datos guardados.', leerEstado($archivo));
    }

    if ($accion === 'reiniciar') {
        $inferior = $entrada['limite inferior'] ?? null;
        $superior = $entrada['limite superior'] ?? null;
        if (!validarLimites($inferior, $superior)) {
            responder(false, 'Los límites recibidos no son válidos.', null, 422);
        }
        guardarEstado($archivo, [
            'limite inferior' => $inferior,
            'limite superior' => $superior,
            'números' => []
        ]);
        responder(true, 'Turnero reiniciado.', leerEstado($archivo));
    }

    responder(false, 'Acción desconocida.', null, 400);
} catch (Throwable $error) {
    responder(false, $error->getMessage(), null, 500);
}
