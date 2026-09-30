<?php
/**
 * Plugin Name:       Easycomex App
 * Description:       Hace que tu sitio de WordPress muestre la app de Easycomex. Cada visitante llega a la misma página de la app; el panel de WordPress (/wp-admin) y tu correo siguen funcionando igual.
 * Version:           1.0.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            Easycomex
 * License:           GPL-2.0-or-later
 * Text Domain:       easycomex-app
 */

// Por qué redirige y no "copia" la app dentro de WordPress:
//
// La app no es un diseño: es un programa con servidor propio (login,
// pagos, cotizador de fletes, Marco Polo, lector de etiquetas). Un
// tema de WordPress sólo podría copiar cómo se ve, sin nada de lo que
// hace. Y meterla en un <iframe> rompe el login con Google y los pagos,
// que por seguridad no se dejan abrir dentro de otra página.
//
// Así que el plugin hace lo único que queda exactamente igual: manda a
// cada visitante a la app, a la sección que corresponde a la página que
// pidió. Se desactiva con un clic y WordPress vuelve a ser el de antes.

if (!defined('ABSPATH')) {
	exit;
}

const EASYCOMEX_APP_URL_DEFAULT = 'https://easycomex.onrender.com';

/**
 * Las páginas que existen en la app, tal cual.
 */
function easycomex_rutas_de_la_app() {
	return array(
		'/roi', '/diagnostico', '/analizar', '/login', '/registro', '/dashboard',
		'/privacidad', '/terminos', '/restablecer', '/pago/exito', '/pago/cancelado', '/estado',
	);
}

/**
 * Las direcciones habituales de un sitio en WordPress, llevadas a la
 * parte de la app que cumple esa función. Lo que no está acá va al
 * inicio: nadie termina en una página de error.
 */
function easycomex_equivalencias() {
	return array(
		'/contacto'                     => '/#contacto',
		'/contactanos'                  => '/#contacto',
		'/contact'                      => '/#contacto',
		'/planes'                       => '/#planes',
		'/precios'                      => '/#planes',
		'/servicios'                    => '/#planes',
		'/calculadora'                  => '/#calculadora',
		'/cotizador'                    => '/#calculadora',
		'/fletes'                       => '/#calculadora',
		'/cotizar'                      => '/#calculadora',
		'/preguntas-frecuentes'         => '/#faq',
		'/faq'                          => '/#faq',
		'/equipo'                       => '/#equipo',
		'/nosotros'                     => '/#equipo',
		'/quienes-somos'                => '/#equipo',
		'/casos'                        => '/#casos',
		'/casos-de-exito'               => '/#casos',
		'/inteligencia-de-mercado'      => '/#inteligencia',
		'/politica-de-privacidad'       => '/privacidad',
		'/terminos-y-condiciones'       => '/terminos',
		'/diagnostico-de-madurez'       => '/diagnostico',
		'/calculadora-roi'              => '/roi',
		'/iniciar-sesion'               => '/login',
		'/mi-cuenta'                    => '/dashboard',
		'/registrarse'                  => '/registro',
	);
}

/**
 * A dónde va una visita. Es una función pura (no toca WordPress) para
 * poder probarla sola.
 *
 * @param string $ruta   La ruta pedida, por ejemplo "/contacto/".
 * @param string $query  Lo que va después del "?", sin el "?".
 * @param string $app    La dirección de la app, sin "/" al final.
 * @return string        La dirección completa de destino.
 */
function easycomex_destino($ruta, $query, $app) {
	$ruta = '/' . trim(strtolower((string) $ruta), '/');
	$ancla = '';

	if ($ruta === '/') {
		$destino = '/';
	} elseif (in_array($ruta, easycomex_rutas_de_la_app(), true)) {
		$destino = $ruta;
	} else {
		$equivalencias = easycomex_equivalencias();
		$destino = isset($equivalencias[$ruta]) ? $equivalencias[$ruta] : '/';
	}

	// El "#seccion" tiene que ir después de la consulta, no antes.
	$pos = strpos($destino, '#');
	if ($pos !== false) {
		$ancla = substr($destino, $pos);
		$destino = substr($destino, 0, $pos);
	}

	// Los parámetros de campañas (utm_*, ref de referidos, fbclid…) se
	// conservan: si no, la publicidad pierde de dónde vino la visita.
	$query = ltrim((string) $query, '?');

	return $app . $destino . ($query !== '' ? '?' . $query : '') . $ancla;
}

function easycomex_url_de_la_app() {
	$url = trim((string) get_option('easycomex_app_url', EASYCOMEX_APP_URL_DEFAULT));
	if ($url === '' || !wp_http_validate_url($url)) {
		return '';
	}
	return untrailingslashit(esc_url_raw($url));
}

add_action('template_redirect', function () {
	if (get_option('easycomex_app_activo', '1') !== '1') {
		return;
	}
	// El panel, las tareas internas y la API de WordPress no se tocan.
	if (is_admin() || wp_doing_ajax() || wp_doing_cron() || (defined('REST_REQUEST') && REST_REQUEST)) {
		return;
	}
	if (function_exists('is_robots') && is_robots()) {
		return;
	}
	// Para ver el WordPress viejo sin apagar el plugin: entrar como
	// administrador y agregar ?sin_app=1 a la dirección.
	if (isset($_GET['sin_app']) && current_user_can('manage_options')) {
		return;
	}

	$app = easycomex_url_de_la_app();
	if ($app === '') {
		return;
	}

	$uri   = isset($_SERVER['REQUEST_URI']) ? wp_unslash($_SERVER['REQUEST_URI']) : '/';
	$ruta  = (string) wp_parse_url($uri, PHP_URL_PATH);
	$query = (string) wp_parse_url($uri, PHP_URL_QUERY);

	// Si WordPress está instalado en una subcarpeta, se le quita.
	$base = (string) wp_parse_url(home_url('/'), PHP_URL_PATH);
	if ($base !== '/' && $base !== '' && strpos($ruta, rtrim($base, '/')) === 0) {
		$ruta = substr($ruta, strlen(rtrim($base, '/')));
	}

	// 302 (temporal) a propósito: un 301 queda guardado en el navegador
	// de cada visitante, y si algún día apagás el plugin, esos
	// navegadores seguirían yendo a la app igual.
	$codigo = get_option('easycomex_permanente', '0') === '1' ? 301 : 302;

	wp_redirect(easycomex_destino($ruta, $query, $app), $codigo, 'Easycomex');
	exit;
});

// ---- Ajustes: Ajustes → Easycomex App -------------------------------

add_action('admin_init', function () {
	register_setting('easycomex_app', 'easycomex_app_url', array(
		'type'              => 'string',
		'sanitize_callback' => function ($valor) {
			$valor = trim((string) $valor);
			return wp_http_validate_url($valor) ? untrailingslashit(esc_url_raw($valor)) : EASYCOMEX_APP_URL_DEFAULT;
		},
		'default'           => EASYCOMEX_APP_URL_DEFAULT,
	));
	$si_no = function ($valor) {
		return $valor === '1' ? '1' : '0';
	};
	register_setting('easycomex_app', 'easycomex_app_activo', array('type' => 'string', 'sanitize_callback' => $si_no, 'default' => '1'));
	register_setting('easycomex_app', 'easycomex_permanente', array('type' => 'string', 'sanitize_callback' => $si_no, 'default' => '0'));
});

add_action('admin_menu', function () {
	add_options_page('Easycomex App', 'Easycomex App', 'manage_options', 'easycomex-app', 'easycomex_pagina_de_ajustes');
});

function easycomex_pagina_de_ajustes() {
	if (!current_user_can('manage_options')) {
		return;
	}
	?>
	<div class="wrap">
		<h1>Easycomex App</h1>
		<p>Mientras esté activo, quien entre a este sitio ve la app de Easycomex. El panel de WordPress sigue funcionando normal.</p>
		<form method="post" action="options.php">
			<?php settings_fields('easycomex_app'); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="easycomex_app_url">Dirección de la app</label></th>
					<td>
						<input name="easycomex_app_url" id="easycomex_app_url" type="url" class="regular-text"
							value="<?php echo esc_attr(get_option('easycomex_app_url', EASYCOMEX_APP_URL_DEFAULT)); ?>">
						<p class="description">La de Render, o <code>https://app.easycomex.com</code> cuando conectes ese subdominio.</p>
					</td>
				</tr>
				<tr>
					<th scope="row">Mostrar la app</th>
					<td>
						<input type="hidden" name="easycomex_app_activo" value="0">
						<label><input name="easycomex_app_activo" type="checkbox" value="1" <?php checked(get_option('easycomex_app_activo', '1'), '1'); ?>>
							Llevar a los visitantes a la app</label>
						<p class="description">Destildalo y el sitio vuelve a ser el WordPress de siempre.</p>
					</td>
				</tr>
				<tr>
					<th scope="row">Redirección permanente</th>
					<td>
						<input type="hidden" name="easycomex_permanente" value="0">
						<label><input name="easycomex_permanente" type="checkbox" value="1" <?php checked(get_option('easycomex_permanente', '0'), '1'); ?>>
							Usar 301 (mejor para Google)</label>
						<p class="description">Activalo sólo cuando estés seguro de quedarte con la app: los navegadores lo recuerdan aunque después lo apagues.</p>
					</td>
				</tr>
			</table>
			<?php submit_button('Guardar'); ?>
		</form>
		<p>Para ver el WordPress anterior sin apagar nada, abrí tu sitio con <code>?sin_app=1</code> al final de la dirección (sólo funciona con tu sesión de administrador).</p>
	</div>
	<?php
}
